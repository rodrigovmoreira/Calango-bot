import time
from playwright.sync_api import sync_playwright

def verify_catalog_variations():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            storage_state={
                "origins": [
                    {
                        "origin": "http://localhost:3000",
                        "localStorage": [
                            {"name": "token", "value": "fake-token"},
                            {"name": "user", "value": '{"id": "123", "name": "Test User"}'}
                        ]
                    }
                ]
            }
        )
        page = context.new_page()

        # Mock API responses
        page.route("**/api/business/config", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"userId": "123", "businessName": "Test Biz", "products": []}'
        ))

        # Navigate to Dashboard
        print("Navigating to Dashboard...")
        page.goto("http://localhost:3000/dashboard")

        # Wait for Catalog Tab or navigate to it if necessary
        # Assuming the Catalog is one of the tabs.
        # Inspecting the code, we might need to find how to switch tabs.
        # Let's try to find a tab with "Catálogo" or "Produtos"

        # Taking a screenshot of the dashboard first to see layout
        page.wait_for_timeout(5000)
        page.screenshot(path="/home/jules/verification/dashboard_initial.png")
        print("Initial screenshot taken.")

        # Try to click on Catalog/Products tab
        # Based on file names, it might be "Catálogo"
        try:
            page.get_by_text("Catálogo").click()
            print("Clicked 'Catálogo' tab.")
        except:
            print("Could not find 'Catálogo' tab directly. Checking screenshot.")

        # Open "New Product" modal
        page.get_by_role("button", name="Novo Item").click()
        print("Opened 'Novo Item' modal.")

        # Fill basic product info
        page.get_by_label("Nome").fill("Serviço Teste")
        page.get_by_label("Preço").fill("100")

        # Check for Variations section
        print("Checking for Variations section...")
        if page.get_by_text("Variações / Opções").is_visible():
            print("Variations section found.")

            # Add a variation
            page.get_by_role("button", name="Add Opção").click()

            # Fill variation details
            page.get_by_placeholder("Nome (ex: Longo)").fill("Var 1")
            page.get_by_placeholder("R$").fill("120")
            page.get_by_placeholder("Min").fill("90")

            print("Variation added.")

            # Take screenshot of the modal with variation
            page.screenshot(path="/home/jules/verification/product_modal_with_variation.png")
            print("Screenshot taken: product_modal_with_variation.png")
        else:
            print("Variations section NOT found.")
            page.screenshot(path="/home/jules/verification/modal_error.png")

        browser.close()

if __name__ == "__main__":
    verify_catalog_variations()
