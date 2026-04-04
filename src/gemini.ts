const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;

export async function fetchGeminiWithRetry(payload: any, maxRetries = 5) {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }
    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error("HTTP error! status: " + response.status);
            const result = await response.json();
            return result;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delays[i]));
        }
    }
}
