import os
import requests
from dotenv import load_dotenv

parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(parent_dir, '.env')
load_dotenv(dotenv_path=env_path)

SERVICENOW_INSTANCE = os.getenv("SERVICENOW_INSTANCE")
SERVICENOW_USERNAME = os.getenv("SERVICENOW_USERNAME")
SERVICENOW_PASSWORD = os.getenv("SERVICENOW_PASSWORD")

def lookup_servicenow_contact(phone: str):
    try:
        print("Searching phone:", phone)
        response = requests.get(
            f"{SERVICENOW_INSTANCE}/api/now/table/customer_contact",
            auth=(SERVICENOW_USERNAME, SERVICENOW_PASSWORD),
            params={
                "sysparm_query": f"mobile_phone={phone}",
                "sysparm_fields": "sys_id,name,mobile_phone",
                "sysparm_limit": "1"
            }
        )

        response.raise_for_status()

        response_json = response.json()

        print("INSTANCE:", SERVICENOW_INSTANCE)
        print("HTTP STATUS:", response.status_code)
        print("BODY:", response.text)

        results = response_json.get("result", [])

        if results:
            print(
                f"ServiceNow match found: "
                f"{results[0]['name']} "
                f"({results[0]['sys_id']})"
            )
            return results[0]["sys_id"]

        print(f"No ServiceNow contact found for {phone}")
        return None

    except Exception as e:
        print("ServiceNow lookup failed:", e)
        return None


def lookup_servicenow_incident(ticket_id: str):
    try:
        response = requests.get(
            f"{SERVICENOW_INSTANCE}/api/now/table/incident",
            auth=(SERVICENOW_USERNAME, SERVICENOW_PASSWORD),
            params={
                "sysparm_query": f"number={ticket_id}",
                "sysparm_fields": "sys_id,number",
                "sysparm_limit": "1"
            }
        )

        response.raise_for_status()

        results = response.json().get("result", [])

        if results:
            return results[0]["sys_id"]

        return None

    except Exception as e:
        print("Incident lookup failed:", e)
        return None



def create_servicenow_incident(data):
    try:
        caller_sys_id = None

        if data.caller_phone:
            caller_sys_id = lookup_servicenow_contact(data.caller_phone)
            print("Caller lookup result:", caller_sys_id)

        payload = {
            "short_description": data.short_description,
            "description": data.description,
            "category": data.category,
            "subcategory": data.subcategory,
            "impact": data.impact,
            "urgency": data.urgency,
        }

        # Add caller only if found
        if caller_sys_id:
            payload["caller_id"] = caller_sys_id

        response = requests.post(
            f"{SERVICENOW_INSTANCE}/api/now/table/incident",
            auth=(SERVICENOW_USERNAME, SERVICENOW_PASSWORD),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json=payload,
        )

        response.raise_for_status()

        result = response.json()["result"]

        return {
            "success": True,
            "sys_id": result["sys_id"],
            "number": result["number"],
        }

    except Exception as e:
        print("Incident creation failed:", e)

        return {
            "success": False,
            "error": str(e),
        }
