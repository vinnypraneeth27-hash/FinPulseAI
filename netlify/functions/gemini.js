export default async (req) => {
    try {
        if (req.method !== "POST") {
            return new Response(
                JSON.stringify({ error: "Method not allowed" }),
                {
                    status: 405,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const { message } = await req.json();

        if (!message) {
            return new Response(
                JSON.stringify({ error: "Message is required" }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [
                            {
                                text: `You are FinPulse AI, a helpful AI financial assistant.

Help users understand their personal expenses, budgets, savings, spending habits, and basic financial planning.

Give simple, clear and practical answers.

Do not claim to be a licensed financial advisor.
Do not make guaranteed investment or financial return claims.
`
                            }
                        ]
                    },
                    contents: [
                        {
                            role: "user",
                            parts: [
                                {
                                    text: message
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return new Response(
                JSON.stringify({
                    error: data.error?.message || "Gemini API error"
                }),
                {
                    status: response.status,
                    headers: {
                        "Content-Type": "application/json"
                    }
                }
            );
        }

        const reply =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Sorry, I couldn't generate a response.";

        return new Response(
            JSON.stringify({ reply }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: "Something went wrong."
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );
    }
};