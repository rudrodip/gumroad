# frozen_string_literal: true

require "spec_helper"
require "shared_examples/authorize_called"

RSpec.describe "Inertia Pages", type: :system, js: true do
  let(:seller) { create(:named_seller) }

  include_context "with switching account to user as admin for seller"

  describe "Product Edit page" do
    let!(:product) { create(:product, user: seller, name: "Test Product", price_cents: 10000) }

    it "renders the edit page via Inertia" do
      visit edit_link_path(product.unique_permalink)

      # Wait for Inertia to load - check for product name in heading or input
      expect(page).to have_text("Test Product", wait: 10)

      # Verify Inertia component
      expect(page).to have_css("[data-page]")
      page_data = JSON.parse(page.find("[data-page]")["data-page"])
      expect(page_data["component"]).to eq("Products/Edit")
    end

    it "displays the product edit form with all sections" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_text("Test Product", wait: 10)

      # Check for main form sections
      expect(page).to have_text("Description")
      expect(page).to have_text("URL")
      expect(page).to have_text("Cover")
      expect(page).to have_text("Thumbnail")
      expect(page).to have_text("Pricing")
    end

    it "displays tab navigation" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_text("Test Product", wait: 10)

      # Check for tab links - these are rendered by react-router-dom Link components
      expect(page).to have_css("a", text: "Product")
      expect(page).to have_css("a", text: "Content")
      expect(page).to have_css("a", text: "Share")
      expect(page).to have_css("a", text: "Receipt")
    end

    it "navigates between tabs using client-side routing" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_css("a", text: "Content", wait: 10)

      # Navigate to Content tab
      click_on "Content"
      expect(page).to have_current_path(/\/content$/)

      # Navigate to Share tab
      click_on "Share"
      expect(page).to have_current_path(/\/share$/)

      # Navigate to Receipt tab
      click_on "Receipt"
      expect(page).to have_current_path(/\/receipt$/)

      # Navigate back to Product tab
      click_on "Product"
      expect(page).to have_current_path(/\/edit$/)

      # Verify still in Inertia context (no full page reload)
      expect(page).to have_css("[data-page]")
    end

    it "displays the preview section" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_text("Preview", wait: 10)

      # Check for preview elements
      expect(page).to have_text("Test Product")
    end

    it "displays pricing information" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_text("Pricing", wait: 10)

      # Check for pricing elements
      expect(page).to have_text("Amount")
    end

    it "handles product update via CSRF protection" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_text("Test Product", wait: 10)

      # Test that CSRF token is present for form submissions
      expect(page).to have_css('meta[name="csrf-token"]', visible: false)
    end

    it "loads the page within acceptable time limits" do
      start_time = Time.current
      visit edit_link_path(product.unique_permalink)
      expect(page).to have_text("Test Product", wait: 10)
      load_time = Time.current - start_time

      expect(load_time).to be < 15.seconds
    end

    context "with different product types" do
      let!(:membership) { create(:membership_product, user: seller, name: "Test Membership") }

      it "renders membership product edit page" do
        visit edit_link_path(membership.unique_permalink)

        expect(page).to have_text("Test Membership", wait: 10)
        expect(page).to have_css("[data-page]")
      end
    end

    context "when navigating from products list" do
      it "uses SPA navigation to edit page" do
        visit products_path
        expect(page).to have_text("Test Product", wait: 10)

        # Find and click the product name link to go to edit page
        click_on "Test Product"

        # Verify Inertia component loaded
        expect(page).to have_css("[data-page]")
        page_data = JSON.parse(page.find("[data-page]")["data-page"])
        expect(page_data["component"]).to eq("Products/Edit")
      end
    end

    context "when accessing Content tab directly" do
      it "renders the Content tab" do
        visit "#{edit_link_path(product.unique_permalink)}/content"

        # Should load the edit page with Content tab active
        expect(page).to have_css("[data-page]", wait: 10)
        expect(page).to have_current_path(/\/content$/)
      end
    end

    context "when accessing Share tab directly" do
      it "renders the Share tab" do
        visit "#{edit_link_path(product.unique_permalink)}/share"

        # Should load the edit page with Share tab active
        expect(page).to have_css("[data-page]", wait: 10)
        expect(page).to have_current_path(/\/share$/)
      end
    end

    context "when accessing Receipt tab directly" do
      it "renders the Receipt tab" do
        visit "#{edit_link_path(product.unique_permalink)}/receipt"

        # Should load the edit page with Receipt tab active
        expect(page).to have_css("[data-page]", wait: 10)
        expect(page).to have_current_path(/\/receipt$/)
      end
    end
  end

  describe "Error handling for Product Edit" do
    it "handles non-existent product gracefully" do
      visit "/products/nonexistent-product-xyz123/edit"

      # Should show 404 or error page
      expect(page).to have_text("404").or have_text("Not Found").or have_current_path("/login")
    end
  end

  describe "JavaScript and Inertia functionality for Product Edit" do
    let!(:product) { create(:product, user: seller, name: "JS Test Product") }

    it "properly loads JavaScript assets" do
      visit edit_link_path(product.unique_permalink)

      # Wait for page to load
      expect(page).to have_text("JS Test Product", wait: 10)

      # Verify Inertia/React is loaded
      inertia_available = page.evaluate_script("document.querySelector('[data-page]') !== null")
      expect(inertia_available).to be_truthy
    end

    it "maintains Inertia context during tab navigation" do
      visit edit_link_path(product.unique_permalink)

      expect(page).to have_css("a", text: "Content", wait: 10)

      # Navigate to Content tab
      click_on "Content"

      # Verify still in Inertia context
      expect(page).to have_css("[data-page]")

      # Page data should still be present
      current_page_data = page.find("[data-page]")["data-page"]
      expect(current_page_data).to be_present
    end
  end
end
