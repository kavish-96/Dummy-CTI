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

@app.post("/incoming-call")
async def incoming_call(data: CallData):
    """Incoming Call API"""
    contact_sys_id = lookup_servicenow_contact(
        data.phone
    )

    message = {
        "type": "incoming_call",
        "customer_name": data.customer_name,
        "phone": data.phone,
        "ticket_id": data.ticket_id,
        "contact_sys_id": contact_sys_id
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)