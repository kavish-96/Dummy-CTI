from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from dotenv import load_dotenv

# Load environment variables from the .env file in the root directory
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(parent_dir, '.env')
load_dotenv(dotenv_path=env_path)

from servicenow import lookup_servicenow_contact, lookup_servicenow_incident, create_servicenow_incident


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
            "url": f"{os.getenv('SERVICENOW_INSTANCE')}/incident.do?sys_id={result['sys_id']}"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)