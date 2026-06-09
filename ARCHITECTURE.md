# Project Architecture & Map

This document outlines the high-level architecture of the CalangoBot CRM. It serves as a guide for understanding the "spine" of the application, the separation of concerns, and the data flow between the Node.js Backend and the React Frontend.

---

## 🏗️ High-Level Structure

The project is a **Monorepo** divided into two main applications:

1.  **Backend (`/backend`)**: Node.js + Express + MongoDB + WhatsApp Web.js.
2.  **Frontend (`/frontend`)**: React + Chakra UI.

---

## 🔙 Backend Architecture (`/backend`)

The backend follows a **Service-Oriented MVC (Model-View-Controller)** pattern.

### 1. 📂 Directory Roles

* **`/routes` (The Doorman)**
    * **Role:** Defines API endpoints. Receives HTTP requests and forwards them to the appropriate Controller.
    * *Example:* `whatsappRoutes.js` defines `POST /api/whatsapp/message`.
* **`/controllers` (The Manager)**
    * **Role:** Handles request validation, extracts data from `req.body`, checks permissions, and delegates the heavy lifting to Services. Returns HTTP responses (`200 OK`, `500 Error`).
    * *Example:* `whatsappController.js` ensures the user is logged in before asking the Service to send a message.
* **`/services` (The Worker)**
    * **Role:** Contains the core business logic. It communicates with the Database, External APIs (OpenAI), and the WhatsApp Client. **Controllers should never contain complex logic.**
    * *Key Services:*
        * `wwebjsService.js`: Manages the WhatsApp Client instance (Connect, Disconnect, Send Message).
        * `aiService.js`: Decides whether to reply to a contact and generates the response logic.
        * `tagService.js`: Manages Tag creation, coloring, and synchronization.
* **`/models` (The Archive)**
    * **Role:** Mongoose Schemas that define how data is stored in MongoDB.
    * *Key Models:* `Contact.js`, `Message.js`, `Tag.js`, `BusinessConfig.js`.
* **`/middleware` (The Security Guard)**
    * **Role:** Intercepts requests to check Authentication (JWT) and Rate Limiting.

### 🔄 Critical Data Flows

#### Flow A: Inbound Message (WhatsApp -> AI Reply)
1.  **Event:** `wwebjsService.js` detects `client.on('message')`.
2.  **Logic:** Calls `aiService.js` to evaluate the message.
3.  **Decision:** `aiService.js` checks `Contact` tags (Whitelist/Blacklist) and `BusinessConfig`.
4.  **Action:** If approved, `aiService.js` calls `wwebjsService.sendMessage()`.
5.  **Persistence:** The message and the reply are saved to MongoDB via `Message` model.

#### Flow B: Outbound Action (User creates a Tag)
1.  **Request:** Frontend sends `POST /api/tags`.
2.  **Route:** `tagRoutes.js` -> `tagController.createTag`.
3.  **Service:** `tagService.js` validates the name and saves it to MongoDB using `Tag` model.
4.  **Response:** Controller returns the new Tag object to the Frontend.

---

## 🖥️ Frontend Architecture (`/frontend`)

The frontend is a Single Page Application (SPA) built with React.

### 1. 📂 Directory Roles

* **`/src/pages` (The Views)**
    * **Role:** High-level layout components representing a full screen/tab.
    * *Key Pages:* `LiveChatTab.jsx`, `SalesFunnel.jsx`, `Dashboard.jsx`.
* **`/src/components` (The Bricks)**
    * **Role:** Reusable UI elements.
    * *Sub-folders:*
        * `/Tags`: `TagAutocomplete.jsx` (The dropdown with colored dots).
        * `/crm`: `CrmSidebar.jsx` (Chat list and Contact info).
        * `/Funnel`: `FunnelBoard.jsx` (Kanban logic).
* **`/src/services` (The Bridge)**
    * **Role:** Axios instances configured to communicate with the Backend API.
    * *Key File:* `api.js` (Centralizes all API calls like `api.getContacts()`).
* **`/src/context` (The State)**
    * **Role:** Manages global state (User session, Theme, WebSocket events).

---

## 🗺️ Debugging Roadmap

Use this map to locate issues based on symptoms:

| Symptom | Layer | Likely File Location |
| :--- | :--- | :--- |
| **Connection Drops / QR Code** | Backend Service | `backend/services/whatsappService.js` |
| **AI Not Replying (Silence)** | Backend Logic | `backend/services/aiService.js` |
| **Tags Not Saving/Coloring** | Backend Controller | `backend/controllers/tagController.js` |
| **Kanban Columns Broken** | Frontend Component | `frontend/src/components/Funnel/FunnelBoard.jsx` |
| **Screen Freeze / UI Error** | Frontend View | `frontend/src/pages/...` |

---

## 🛡️ Development Rules

1.  **Single Source of Truth:** Tags are now stored in the `Tags` collection (Objects), not just as Strings in `Contacts`.
2.  **Separation:** Never write DB queries directly in a Controller. Use a Service.
3.  **Stability:** The WhatsApp client must auto-reconnect on failure (`LocalAuth` strategy).
4. **(DDD):** Nenhuma regra de negócio deve importar serviços de infraestrutura (como WhatsApp ou MongoDB). Use Injeção de Dependência.
5. **Early Return:** É expressamente proibido o aninhamento de if maior que 2 níveis. Use retornos antecipados.
6. **SRP:** Se uma função passar de 50 linhas, o agente DEVE questionar a arquitetura antes de prosseguir.