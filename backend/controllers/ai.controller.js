import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini if key exists
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

export const generatePollOptions = async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || question.trim() === "") {
            return res.status(400).json({ success: false, message: "Question is required." });
        }

        if (genAI) {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `You are a helpful assistant for a social media app called Ideate.
The user wants to create a poll but only has a question. 
Generate 2 to 4 distinct, concise poll options (max 30 characters each) for this question: "${question}".
Return the options as a JSON array of strings and nothing else. Do not use markdown code block formatting. Return only the raw JSON. Example: ["Option A", "Option B"]`;
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            // Parse options
            let options = [];
            try {
                // Strip markdown code block markers if the model returns them despite instructions
                const cleanedText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
                options = JSON.parse(cleanedText);
            } catch (e) {
                console.error("Failed to parse Gemini response:", responseText);
                // Fallback to simple extraction
                options = responseText.split("\n")
                    .map(opt => opt.replace(/^-\s*/, "").replace(/^\d+\.\s*/, "").trim())
                    .filter(Boolean);
            }
            if (options.length >= 2) {
                return res.status(200).json({ success: true, options });
            }
        }

        // Fallback option generation
        const fallbackOptions = [
            "Yes, absolutely",
            "No, I disagree",
            "It depends / Maybe",
            "Show results"
        ];
        return res.status(200).json({ success: true, options: fallbackOptions, fallback: true });

    } catch (error) {
        console.error("AI Option Generation Error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate options." });
    }
};

export const checkSpamAndToxicity = async (content) => {
    // Return safety status: { isViolating: boolean, reason: string }
    if (!content || content.trim() === "") return { isViolating: false };

    // 1. Local basic check (regex) for very obvious spam/slurs
    const toxicKeywords = ["spammyword123", "hatespeechword", "kill yourself", "kys", "make money fast online now", "cheap viagra"];
    for (const keyword of toxicKeywords) {
        if (content.toLowerCase().includes(keyword)) {
            return { isViolating: true, reason: `Contains forbidden terms: ${keyword}` };
        }
    }

    // 2. Gemini API check if available
    if (genAI) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `Analyze the following social media post text for extreme toxicity, hate speech, severe harassment, or explicit commercial spam.
If it violates community standards (hate speech, self-harm encouragement, direct abuse, or explicit spam), return "VIOLATION" followed by a short reason.
Otherwise, return "CLEAN".
Post text: "${content}"`;
            
            const result = await model.generateContent(prompt);
            const responseText = result.response.text().trim();
            if (responseText.startsWith("VIOLATION")) {
                return { isViolating: true, reason: responseText.replace("VIOLATION", "").trim() };
            }
        } catch (e) {
            console.error("Gemini toxicity check failed, fallback to local clean:", e);
        }
    }

    return { isViolating: false };
};

// Route wrapper for explicit frontend toxicity check if needed
export const analyzeContentRoute = async (req, res) => {
    try {
        const { content } = req.body;
        const result = await checkSpamAndToxicity(content);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Server error checking content." });
    }
};
