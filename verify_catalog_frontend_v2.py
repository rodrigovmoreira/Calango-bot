from playwright.sync_api import sync_playwright
import time
import os

def verify_catalog_variations():
    # Ensure verification directory exists
    os.makedirs("/home/jules/verification", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create context with mocked authentication state
        context = browser.new_context()

        # Add a fake token to local storage before navigating
        # We need to navigate to the origin first to set local storage,
        # but since we might hit a redirect if not auth, we can try adding an init script
        context.add_init_script("""
            localStorage.setItem('token', 'fake-token-123');
            localStorage.setItem('user', JSON.stringify({id: 'user123', name: 'Test User', email: 'test@example.com'}));
        """)

        page = context.new_page()

        # Mock critical API endpoints to prevent backend dependency and ensure consistent state

        # 1. Mock /api/business/config (GET)
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"userId": "user123", "businessName": "Test Business", "products": []}'
        ))

        # 2. Mock /api/dashboard/summary (GET) - often needed for dashboard load
        page.route("**/api/dashboard/summary", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"totalContacts": 10, "activeChats": 2, "pendingFollowups": 5}'
        ))

        # 3. Mock /api/contacts (GET) - to prevent errors on main dashboard
        page.route("**/api/contacts*", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[]'
        ))

        print("Navigating to Dashboard...")
        try:
            # Go to root, likely redirects to dashboard or login
            # Since we injected token, hopefully it goes to dashboard
            page.goto("http://localhost:3000/dashboard")
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Navigation error: {e}")

        print(f"Current URL: {page.url}")

        # Take a screenshot of the initial state
        page.screenshot(path="/home/jules/verification/01_dashboard_load.png")

        # Look for the Catalog/Products tab
        # We need to find the tab button. Inspecting the code (CatalogTab.jsx) suggests it's a tab content.
        # But we need to click the Tab header.
        # Usually tabs are in a tab list. Let's try finding by text "Catálogo" or "Produtos"

        print("Looking for Catalog tab...")
        catalog_tab = page.get_by_text("Catálogo")
        if catalog_tab.count() > 0:
            catalog_tab.click()
            print("Clicked Catálogo tab")
        else:
            # Try "Produtos"
            products_tab = page.get_by_text("Produtos")
            if products_tab.count() > 0:
                products_tab.click()
                print("Clicked Produtos tab")
            else:
                 print("Could not find specific tab text. Taking screenshot.")

        page.wait_for_timeout(1000)
        page.screenshot(path="/home/jules/verification/02_tab_view.png")

        # Click "Novo Item" button
        print("Clicking 'Novo Item'...")
        try:
            page.get_by_role("button", name="Novo Item").click()
            page.wait_for_timeout(500) # Wait for modal animation
        except Exception as e:
             print(f"Error clicking Novo Item: {e}")

        page.screenshot(path="/home/jules/verification/03_modal_open.png")

        # Fill basic info
        print("Filling product info...")
        page.get_by_label("Nome").fill("Corte de Cabelo")
        page.get_by_label("Preço").fill("50")

        # Verify Variations UI
        print("Verifying Variations UI...")

        # Check if the section header exists
        variations_header = page.get_by_text("Variações / Opções")
        if variations_header.is_visible():
            print("SUCCESS: Variations section header found.")
        else:
            print("FAILURE: Variations section header NOT found.")

        # Click "Add Opção"
        add_btn = page.get_by_role("button", name="Add Opção")
        if add_btn.is_visible():
            add_btn.click()
            print("Clicked Add Opção")
            page.wait_for_timeout(200)

            # Verify inputs appeared
            # We can check for the placeholders we added: "Nome (ex: Longo)", "R$", "Min"
            if page.get_by_placeholder("Nome (ex: Longo)").is_visible():
                 print("SUCCESS: Variation name input found.")
                 page.get_by_placeholder("Nome (ex: Longo)").fill("Curto")

            if page.get_by_placeholder("R$").is_visible():
                 print("SUCCESS: Variation price input found.")
                 page.get_by_placeholder("R$").fill("45")

            if page.get_by_placeholder("Min").is_visible():
                 print("SUCCESS: Variation duration input found.")
                 page.get_by_placeholder("Min").fill("30")

            # Take final screenshot of the populated modal
            page.screenshot(path="/home/jules/verification/04_modal_with_variations.png")
            print("Final screenshot saved to /home/jules/verification/04_modal_with_variations.png")

        else:
            print("FAILURE: Add Opção button NOT found.")

        browser.close()

if __name__ == "__main__":
    verify_catalog_variations()
