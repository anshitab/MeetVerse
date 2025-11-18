"""
Google Gemini LLM Agent for task fulfillment
"""
import google.generativeai as genai
import os
import json

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-pro")

class LLMAgent:
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel(MODEL)
    
    def process_command(self, command: str, meeting_id: str, context: dict = None):
        """Process user command and generate response"""
        
        # Build context from transcripts
        context_text = ""
        if context and context.get("documents"):
            context_text = "\n\n".join([
                doc for doc in context["documents"]
            ])
        
        system_prompt = """You are an AI Intern assistant for meetings. Your role is to:
1. Understand meeting context from transcripts
2. Generate summaries, proposals, action items
3. Create structured documents when requested
4. Answer questions about the meeting

When a user requests document generation, respond with JSON:
{
    "response": "Your text response",
    "generate_document": true,
    "document_type": "docx|pdf|pptx",
    "content": "Full document content"
}

Otherwise, respond with:
{
    "response": "Your response text",
    "generate_document": false
}"""
        
        user_prompt = f"""Meeting ID: {meeting_id}

Meeting Context:
{context_text[:5000] if context_text else "No context available"}

User Command: {command}

Please process this command and provide a helpful response."""
        
        try:
            # Combine system and user prompts for Gemini
            full_prompt = f"{system_prompt}\n\n{user_prompt}"
            
            generation_config = {
                "temperature": 0.7,
            }
            
            # Try to get JSON response
            try:
                response = self.model.generate_content(
                    full_prompt,
                    generation_config=generation_config
                )
            except Exception:
                # Fallback without JSON constraint
                response = self.model.generate_content(full_prompt)
            
            # Parse JSON response
            result_text = response.text.strip() if hasattr(response, 'text') else str(response).strip()
            # Remove markdown code blocks if present
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.startswith("```"):
                result_text = result_text[3:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()
            
            result = json.loads(result_text)
            return result
            
        except json.JSONDecodeError as e:
            # If JSON parsing fails, try to extract JSON from response
            try:
                # Try to find JSON in the response
                import re
                response_text = response.text if hasattr(response, 'text') else str(response)
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    result = json.loads(json_match.group())
                    return result
            except:
                pass
            response_text = response.text if hasattr(response, 'text') else str(response)
            return {
                "response": f"Error parsing AI response: {str(e)}\n\nResponse: {response_text[:200]}",
                "generate_document": False
            }
        except Exception as e:
            return {
                "response": f"Error processing command: {str(e)}",
                "generate_document": False
            }

