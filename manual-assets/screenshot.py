from playwright.sync_api import sync_playwright
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
pages = [
    ("welcome.html", "screenshot-welcome.png"),
    ("setup.html", "screenshot-setup.png"),
    ("checkin.html", "screenshot-checkin.png"),
    ("logs.html", "screenshot-logs.png"),
    ("ai.html", "screenshot-ai.png"),
    ("farm-menu.html", "screenshot-farm-menu.png"),
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for html_file, png_file in pages:
        page = browser.new_page(viewport={"width": 390, "height": 844})
        file_path = os.path.join(base_dir, html_file)
        page.goto(f"file:///{file_path.replace('\\', '/')}")
        page.wait_for_timeout(500)
        screenshot_path = os.path.join(base_dir, png_file)
        page.screenshot(path=screenshot_path, full_page=True)
        print(f"Saved: {screenshot_path}")
        page.close()
    browser.close()
    print("All screenshots done!")
