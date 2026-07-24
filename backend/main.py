from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import requests
import os
from dotenv import load_dotenv

# Load environment variables from the .env file in the root directory
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(parent_dir, '.env')
load_dotenv(dotenv_path=env_path)

SERVICENOW_INSTANCE = os.getenv("SERVICENOW_INSTANCE")
SERVICENOW_USERNAME = os.getenv("SERVICENOW_USERNAME")
SERVICENOW_PASSWORD = os.getenv("SERVICENOW_PASSWORD")

# print("INSTANCE =", SERVICENOW_INSTANCE)
# print("USERNAME =", SERVICENOW_USERNAME)
# print("PASSWORD EXISTS =", bool(SERVICENOW_PASSWORD))

app = FastAPI()

# Allow all origins for CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CallData(BaseModel):
    customer_name: str
    phone: str
    ticket_id: str
    # contact_sys_id: str

class ClickToCallData(BaseModel):
    phone: str
    contact_name: str | None = None
    source: str | None = None

class ScreenPopIncidentData(BaseModel):
    incident_id: str


class CreateIncidentData(BaseModel):
    caller_phone: str | None = None
    short_description: str
    description: str | None = ""
    category: str | None = "inquiry"
    subcategory: str | None = "phone"
    impact: str | None = "2"
    urgency: str | None = "2"


# Store connected clients
connected_clients: list[WebSocket] = []


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

        # print("SERVICENOW RESPONSE:")
        # print(response_json)
        print("INSTANCE:", SERVICENOW_INSTANCE)
        print("HTTP STATUS:", response.status_code)
        print("BODY:", response.text)

        results = response_json.get("result", [])

        # results = response.json().get("result", [])

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



def create_servicenow_incident(data: CreateIncidentData):
    try:
        caller_sys_id = None

        if data.caller_phone:
            caller_sys_id = lookup_servicenow_contact(data.caller_phone)

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



@app.get("/")
async def health_check():
    """Optional Health Check"""
    return {"message": "CTI Backend Running"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket Endpoint"""
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                data = json.loads(data_text)
                msg_type = data.get("type")
                
                if msg_type == "dial_call":
                    phone = data.get("phone")
                    print(f"Dial Request Received: {phone}")
                    response = {
                        "type": "outbound_call_started",
                        "phone": phone
                    }
                    for client in connected_clients:
                        try:
                            await client.send_text(json.dumps(response))
                        except Exception:
                            pass
                            
                elif msg_type == "end_outbound_call":
                    phone = data.get("phone")
                    response = {
                        "type": "outbound_call_ended",
                        "phone": phone
                    }
                    for client in connected_clients:
                        try:
                            await client.send_text(json.dumps(response))
                        except Exception:
                            pass
                            
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        connected_clients.remove(websocket)


@app.post("/screen-pop-incident")
async def screen_pop_incident(
    data: ScreenPopIncidentData
):

    incident_sys_id = lookup_servicenow_incident(
        data.incident_id
    )

    if not incident_sys_id:
        return {
            "success": False,
            "message": "Incident not found"
        }

    message = {
        "type": "screen_pop_incident",
        "incident_sys_id": incident_sys_id,
        "incident_id": data.incident_id
    }

    for client in connected_clients:
        try:
            await client.send_text(
                json.dumps(message)
            )
        except Exception:
            pass

    return {
        "success": True,
        "incident_id": data.incident_id
    }


@app.post("/incoming-call")
async def incoming_call(data: CallData):
    """Incoming Call API"""
    contact_sys_id = lookup_servicenow_contact(
        data.phone
    )

    # incident_sys_id = lookup_servicenow_incident(
    #     data.ticket_id
    # )

    message = {
        "type": "incoming_call",
        "build": "render-test-v99",
        "customer_name": data.customer_name,
        "phone": data.phone,
        "ticket_id": data.ticket_id,
        "contact_sys_id": contact_sys_id
        # "incident_sys_id": incident_sys_id
    }
    
    # Broadcast to all connected clients

    for client in connected_clients:
        try:
            await client.send_text(json.dumps(message))
        except Exception:
            pass

    return {"status": "success"}

@app.post("/click-to-call")
async def click_to_call(data: ClickToCallData):
    """Click-to-Call API"""
    print(f"Click-to-call request: {data.phone}")
    message = {
        "type": "dial_call",
        "phone": data.phone,
        "contact_name": data.contact_name,
        "source": data.source
    }
    
    # Broadcast to all connected clients
    for client in connected_clients:
        try:
            await client.send_text(json.dumps(message))
        except Exception:
            pass

    return {"status": "success"}


@app.post("/incidents")
async def create_incident(data: CreateIncidentData):

    result = create_servicenow_incident(data)

    if not result["success"]:
        return result

    return {
        "success": True,
        "incident": {
            "number": result["number"],
            "sys_id": result["sys_id"],
            "url": f"{SERVICENOW_INSTANCE}/incident.do?sys_id={result['sys_id']}"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)