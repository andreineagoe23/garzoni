import os
from google.cloud import dialogflow_v2 as dialogflow
from google.api_core.exceptions import InvalidArgument

# Ensure the environment variable is set
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "G:/monevo/backend/chartwise/monevocredentials.json"

def detect_intent_from_text(project_id, text, session_id, language_code='en'):
    try:
        session_client = dialogflow.SessionsClient()
        session_path = session_client.session_path(project_id, session_id)

        text_input = dialogflow.TextInput(text=text, language_code=language_code)
        query_input = dialogflow.QueryInput(text=text_input)

        response = session_client.detect_intent(request={"session": session_path, "query_input": query_input})
        return response.query_result.fulfillment_text
    except InvalidArgument as e:
        raise ValueError(f"Invalid Dialogflow argument: {e}")
    except Exception as e:
        raise RuntimeError(f"Error communicating with Dialogflow API: {e}")
