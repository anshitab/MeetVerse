"""
Google Gemini LLM Agent for task fulfillment
"""
import google.generativeai as genai
import os
import json

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

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
3. Answer questions about the meeting

Respond with:
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


# Global agent instance
_agent_instance = None

def get_agent():
    """Get or create the LLM agent instance"""
    global _agent_instance
    if _agent_instance is None:
        try:
            _agent_instance = LLMAgent()
        except ValueError:
            # If API key is not set, return None and handle gracefully
            return None
    return _agent_instance


async def run_ai_agent(command: str, context = None) -> str:
    """
    Async wrapper function for running AI agent tasks.
    Returns the response text as a string.
    
    Args:
        command: The user command/query
        context: List of context items from vector_store.get_full_meeting_context()
    """
    agent = get_agent()
    if agent is None:
        return "Error: GEMINI_API_KEY environment variable is not set. Please configure your API key."
    
    try:
        # Extract meeting_id from context if available
        meeting_id = ""
        if context and isinstance(context, list) and len(context) > 0:
            # Try to get meeting_id from first context item's metadata
            first_item = context[0]
            if isinstance(first_item, dict):
                meeting_id = first_item.get("metadata", {}).get("meeting_id", "") if isinstance(first_item.get("metadata"), dict) else ""
        
        # Convert context list to dict format expected by process_command
        context_dict = None
        if context and isinstance(context, list):
            # Extract documents/transcripts from context
            documents = []
            for item in context:
                if isinstance(item, dict):
                    content = item.get("content", "")
                    if content:
                        documents.append(content)
            if documents:
                context_dict = {"documents": documents}
        
        result = agent.process_command(command, meeting_id, context_dict)
        
        # Extract response text from result
        if isinstance(result, dict):
            return result.get("response", str(result))
        return str(result)
    except Exception as e:
        return f"Error running AI agent: {str(e)}"

