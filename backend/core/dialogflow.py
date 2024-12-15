import os
import requests
from google.cloud import dialogflow_v2 as dialogflow
from google.api_core.exceptions import InvalidArgument

# Set environment variable for Dialogflow credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "G:/monevo/backend/chartwise/monevocredentials.json"

def detect_intent_from_text(project_id, text, session_id, language_code='en'):
    try:
        # Dialogflow session setup
        session_client = dialogflow.SessionsClient()
        session_path = session_client.session_path(project_id, session_id)

        text_input = dialogflow.TextInput(text=text, language_code=language_code)
        query_input = dialogflow.QueryInput(text=text_input)

        response = session_client.detect_intent(request={"session": session_path, "query_input": query_input})

        # Handle specific intent for web search
        if response.query_result.intent.display_name == "SearchTheWeb":
            search_query = response.query_result.query_text
            return perform_web_search(search_query)

        return response.query_result.fulfillment_text
    except InvalidArgument as e:
        raise ValueError(f"Invalid Dialogflow argument: {e}")
    except Exception as e:
        raise RuntimeError(f"Error communicating with Dialogflow API: {e}")

def perform_web_search(query):
    """Perform a Google Custom Search using the API."""
    try:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": API_KEY,
            "cx": CSE_ID,
            "q": query,
        }
        response = requests.get(url, params=params)
        data = response.json()

        if "items" in data:
            # Extract title and link from the first result
            first_result = data["items"][0]
            title = first_result.get("title", "No title available")
            link = first_result.get("link", "No link available")
            return f"Here's what I found: {title} - {link}"

        return "I couldn't find anything relevant. Please try rephrasing your query."
    except Exception as e:
        return f"An error occurred while performing the web search: {str(e)}"
