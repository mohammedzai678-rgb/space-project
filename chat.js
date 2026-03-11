const CHAT_API_PATH = "http://127.0.0.1:5000/api/chat";
const CHAT_POSITION_KEY = "orbital-chat-position-v1";

// 1. SELECT ELEMENTS
const chatWrapper = document.getElementById("ai-chat-wrapper");
const chatToggle = document.getElementById('chat-toggle-btn');
const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatHistory = document.getElementById('chat-history');

// 2. INITIALIZE
if (chatWrapper && chatToggle && chatWindow && chatForm && chatHistory) {
    restoreChatPosition();
    setupToggleDrag();
    setupChatForm();
}

// 3. TOGGLE & DRAG LOGIC
function setupToggleDrag() {
    let dragging = false;
    let moved = false;
    let startX, startY, pointerId = null;

    chatToggle.addEventListener("pointerdown", (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        startY = e.clientY;
        pointerId = e.pointerId;
        chatToggle.setPointerCapture(pointerId);
        
        // Ensure wrapper is on top when touched
        chatWrapper.style.zIndex = "10001";
    });

    chatToggle.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        // Threshold to differentiate click from drag
        if (!moved && Math.hypot(deltaX, deltaY) > 5) moved = true;
        
        if (moved) {
            positionChatWrapper(e.clientX, e.clientY);
        }
    });

    chatToggle.addEventListener("pointerup", (e) => {
        if (pointerId !== null) chatToggle.releasePointerCapture(pointerId);
        dragging = false;
        pointerId = null;

        if (moved) {
            saveChatPosition();
        } else {
            // FIX: Perfect Click-to-Open / Click-to-Close
            const isHidden = chatWindow.classList.toggle("hidden");
            chatToggle.setAttribute("aria-expanded", String(!isHidden));
            
            // Bring to front when opened
            if (!isHidden) {
                chatWrapper.style.zIndex = "10001";
            }
        }
    });
}

function positionChatWrapper(pointerX, pointerY) {
    const wrapperWidth = chatWrapper.offsetWidth || 56;
    const wrapperHeight = chatWrapper.offsetHeight || 56;
    
    // Boundary checks to keep it on screen
    const nextLeft = Math.max(8, Math.min(window.innerWidth - wrapperWidth - 8, pointerX - 26));
    const nextTop = Math.max(8, Math.min(window.innerHeight - wrapperHeight - 8, pointerY - 26));

    chatWrapper.style.left = `${nextLeft}px`;
    chatWrapper.style.top = `${nextTop}px`;
    chatWrapper.style.right = "auto";
    chatWrapper.style.bottom = "auto";
}

function saveChatPosition() {
    const rect = chatWrapper.getBoundingClientRect();
    localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify({
        left: Math.round(rect.left),
        top: Math.round(rect.top)
    }));
}

function restoreChatPosition() {
    try {
        const raw = localStorage.getItem(CHAT_POSITION_KEY);
        if (!raw) return;
        const pos = JSON.parse(raw);
        
        // Apply saved position
        chatWrapper.style.left = `${pos.left}px`;
        chatWrapper.style.top = `${pos.top}px`;
        chatWrapper.style.right = "auto";
        chatWrapper.style.bottom = "auto";
        chatWrapper.style.zIndex = "10001";
    } catch (e) { 
        console.error("Failed to restore position:", e); 
    }
}

// 4. CHAT FUNCTIONALITY
function setupChatForm() {
    chatForm.onsubmit = async (e) => {
        e.preventDefault();
        const msg = chatInput.value.trim();
        if (!msg) return;

        // 1. Add User Message to UI
        addMessage("user", msg);
        chatInput.value = '';

        // 2. Add "Thinking" placeholder
        const botMsgDiv = addMessage("bot", "Thinking...");

        try {
            const res = await fetch(CHAT_API_PATH, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg }) 
            });

            const data = await res.json();
            
            if (data.response) {
                // 3. Replace "Thinking..." with real response
                // Convert newlines to <br> so the UI handles paragraphs correctly
                botMsgDiv.innerHTML = data.response.replace(/\n/g, '<br>');
            } else {
                botMsgDiv.textContent = "Mission Control: AI returned an empty response.";
            }
        } catch (err) {
            botMsgDiv.textContent = "Mission Control: AI Link Failure. Check if server.py is running.";
            console.error("Fetch Error:", err);
        }
        
        // Auto-scroll to latest message
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };
}

function addMessage(role, text) {
    const item = document.createElement("div");
    // This creates the class 'user-msg' or 'bot-msg'
    item.className = `chat-msg ${role}-msg`; 
    item.textContent = text;
    chatHistory.appendChild(item);
    
    // Scroll to bottom immediately
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return item;
}