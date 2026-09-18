const messageInput = document.getElementById("message");
const sendButton = document.getElementById("sendButton");
const chat = document.getElementById("chat");

async function sendMessage() {

    const message = messageInput.value.trim();

    if (!message) {
        return;
    }

    // Show user message
    const userMessage = document.createElement("div");

    userMessage.className = "message user";
    userMessage.textContent = message;

    chat.appendChild(userMessage);

    // Clear input
    messageInput.value = "";

    // Disable button while AI responds
    sendButton.disabled = true;

    // Show loading message
    const aiMessage = document.createElement("div");

    aiMessage.className = "message ai";
    aiMessage.textContent = "FinPulse AI is thinking...";

    chat.appendChild(aiMessage);

    // Scroll to bottom
    chat.scrollTop = chat.scrollHeight;

    try {

        const response = await fetch(
            "/.netlify/functions/gemini",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    message: message
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong");
        }

        // Display Gemini response
        aiMessage.textContent = data.reply;

    } catch (error) {

        console.error(error);

        aiMessage.textContent =
            "Sorry, I couldn't connect to FinPulse AI. Please try again.";

    } finally {

        sendButton.disabled = false;

        messageInput.focus();

        chat.scrollTop = chat.scrollHeight;
    }
}


// Send when button is clicked
sendButton.addEventListener("click", sendMessage);


// Send when Enter is pressed
messageInput.addEventListener("keydown", function(event) {

    if (event.key === "Enter") {
        sendMessage();
    }

});