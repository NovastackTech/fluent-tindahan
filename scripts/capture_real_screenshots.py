import asyncio
import json
import base64
import subprocess
import time
import requests
import websockets
from pathlib import Path
from PIL import Image
import io

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
USER_DATA_DIR = Path.home() / "AppData" / "Local" / "Temp" / "isolated_chrome_cdp"
PORT = 9333

async def capture_tab(ws_url, width, height, output_path, tab_param="pos", is_mobile=False):
    async with websockets.connect(ws_url) as ws:
        msg_id = 1
        
        async def send(method, params=None):
            nonlocal msg_id
            payload = {"id": msg_id, "method": method, "params": params or {}}
            msg_id += 1
            await ws.send(json.dumps(payload))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == payload["id"]:
                    return data.get("result", {})

        await send("Page.enable")
        await send("DOM.enable")
        
        # Set viewport
        await send("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": is_mobile
        })
        
        # Navigate to app tab
        target_url = f"http://127.0.0.1:4173/?tab={tab_param}"
        await send("Page.navigate", {"url": target_url})
        await asyncio.sleep(2.5)
        
        # Set localStorage and dismiss any consent modal, then reload
        await send("Runtime.evaluate", {
            "expression": """
                localStorage.setItem('fluent_tindahan_consent_v1', 'true');
                localStorage.setItem('fluent_tindahan_pwa_install_dismissed', 'true');
            """
        })
        await send("Page.reload")
        await asyncio.sleep(2.0)
        
        # Capture screenshot
        result = await send("Page.captureScreenshot", {
            "format": "png",
            "clip": {
                "x": 0,
                "y": 0,
                "width": width,
                "height": height,
                "scale": 1
            }
        })
        
        img_bytes = base64.b64decode(result["data"])
        img = Image.open(io.BytesIO(img_bytes))
        if img.size != (width, height):
            img = img.resize((width, height), Image.Resampling.LANCZOS)
        img.save(output_path, "PNG")
        print(f"[OK] Captured real UI screenshot ({width}x{height}) -> {output_path}")

def main():
    repo_root = Path(__file__).resolve().parents[1]
    screenshots_dir = repo_root / "frontend" / "public" / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)
    
    wide_path = screenshots_dir / "screenshot-wide.png"
    narrow_path = screenshots_dir / "screenshot-narrow.png"
    
    USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME_PATH,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        "--remote-allow-origins=*",
        f"--user-data-dir={USER_DATA_DIR}",
        "--hide-scrollbars",
        "--disable-gpu",
        "about:blank"
    ]
    proc = subprocess.Popen(cmd)
    try:
        # Wait for Chrome CDP to be available
        for _ in range(20):
            try:
                res = requests.get(f"http://127.0.0.1:{PORT}/json/version", timeout=1)
                if res.status_code == 200:
                    break
            except Exception:
                time.sleep(0.5)
        
        # 1. Wide screenshot (1280x720 - POS desktop view)
        tab_res = requests.put(f"http://127.0.0.1:{PORT}/json/new?http://127.0.0.1:4173/?tab=pos").json()
        ws_url = tab_res["webSocketDebuggerUrl"]
        asyncio.run(capture_tab(ws_url, 1280, 720, wide_path, tab_param="pos", is_mobile=False))
        requests.get(f"http://127.0.0.1:{PORT}/json/close/{tab_res['id']}")
        
        # 2. Narrow screenshot (540x960 - Dashboard mobile view)
        tab_res_m = requests.put(f"http://127.0.0.1:{PORT}/json/new?http://127.0.0.1:4173/?tab=dashboard").json()
        ws_url_m = tab_res_m["webSocketDebuggerUrl"]
        asyncio.run(capture_tab(ws_url_m, 540, 960, narrow_path, tab_param="dashboard", is_mobile=True))
        requests.get(f"http://127.0.0.1:{PORT}/json/close/{tab_res_m['id']}")
        
    finally:
        proc.terminate()
        proc.wait(timeout=5)

if __name__ == "__main__":
    main()
