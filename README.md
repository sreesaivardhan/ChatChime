# ChatApp

A modern, local web chat application built with HTML, CSS, and JavaScript. Supports persistent chat rooms, real-time-like messaging (local simulation), emoji picker, typing indicators, and more — all in your browser using localStorage.

---

## 🚀 Features
- **Login system** with username validation
- **Multiple chat rooms** (create, delete, join)
- **Message sending** with formatting (bold, italic, code)
- **Emoji picker**
- **Typing indicators**
- **Online users list**
- **Persistent storage** via localStorage
- **Responsive design** for desktop and mobile
- **No backend required** — everything runs locally

---

## 🛠️ Getting Started

### Prerequisites
- [VSCode](https://code.visualstudio.com/) or any code editor
- [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension (or use Python/Node local server)
- Modern web browser (Chrome, Edge, Firefox, etc.)

### Setup & Run
1. **Clone or download this repository** to your local machine.
2. **Open the project folder in VSCode.**
3. **Right-click `index.html` and select "Open with Live Server"** (or click "Go Live" in VSCode).
   - Alternatively, run a local server in the folder:
     - Python: `python -m http.server 8000`
     - Node: `npx http-server .`
4. **Visit** `http://localhost:5500` (or the port shown in your editor) in your browser.
5. **Register a username and start chatting!**

---

## 📄 File Structure
```
chat-app/
├── index.html        # Login page
├── chat.html         # Main chat UI
├── script.js         # All JavaScript logic
├── style.css         # App styling
├── README.md         # This file
```

---

## ❓ Troubleshooting
- **Login page reloads or chat doesn’t load:**
  - Make sure you are running the app via a local server, not by double-clicking the HTML file.
  - Open browser console (F12) and check for JavaScript errors.
- **localStorage errors:**
  - Some browsers block localStorage on `file://` URLs. Always use a server.
- **Script errors:**
  - Ensure `script.js` is correctly linked at the bottom of both HTML files.
- **UI elements missing:**
  - Make sure you have not modified required element IDs/classes in the HTML.

---

## 👨‍💻 Credits
- Developed by [Your Name]
- Inspired by modern chat UIs and open-source chat concepts

---

## 📬 Feedback & Contributions
Feel free to open issues or submit pull requests to improve the app!
