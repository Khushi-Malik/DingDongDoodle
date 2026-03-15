import { NextResponse } from "next/server";

type CharacterInput = {
  name: string;
  age: number;
  memories?: Array<{ text: string }>;
};

type CohereMessagePart = {
  type?: string;
  text?: string;
};

function extractCohereText(data: unknown): string {
  if (!data || typeof data !== "object") return "";

  const record = data as Record<string, unknown>;

  const outputText = record.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const directText = record.text;
  if (typeof directText === "string" && directText.trim()) {
    return directText.trim();
  }

  const message =
    record.message && typeof record.message === "object"
      ? (record.message as Record<string, unknown>)
      : null;
  const content = message?.content;

  if (Array.isArray(content)) {
    const parts = content as CohereMessagePart[];

    const firstTextPart = parts.find(
      (part) => typeof part?.text === "string" && part.text.trim().length > 0
    );
    if (firstTextPart?.text) {
      return firstTextPart.text.trim();
    }
  }

  return "";
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "COHERE_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const characters: CharacterInput[] = Array.isArray(body.characters)
      ? body.characters
      : [];

    if (characters.length === 0) {
      return NextResponse.json(
        { error: "At least one character is required" },
        { status: 400 }
      );
    }

    const characterDescriptions = characters
      .map((character) => {
        const memories = character.memories
          ?.map((memory) => memory.text)
          .filter(Boolean)
          .join(", ");
        return `${character.name} (age ${character.age})${
          memories ? `, who ${memories}` : ""
        }`;
      })
      .join("; ");

    const childName = String(body.childName || "").trim();
    const childAge = String(body.childAge || "").trim();
    const conceptLabel = String(body.conceptLabel || body.concept || "").trim();
    const settingLabel = String(body.settingLabel || body.setting || "").trim();
    const storyLength = String(body.storyLength || "medium").trim();
    const favoriteThings = String(body.favoriteThings || "").trim();
    const extraNote = String(body.extraNote || "").trim();

    const wordCount =
      storyLength === "short" ? 200 : storyLength === "medium" ? 400 : 600;

    const prompt = `Write a children's bedtime story for a ${childAge || "young"}-year-old named ${
      childName || "a child"
    }.

Characters in the story: ${characterDescriptions}

The story should naturally teach the value of: **${conceptLabel || "kindness"}**
Setting: ${settingLabel || "a magical place"}
Length: approximately ${wordCount} words
${favoriteThings ? `The child loves: ${favoriteThings} - weave these in naturally.` : ""}
${extraNote ? `Parent's note: ${extraNote}` : ""}

Guidelines:
- Use the characters' personal memories and traits to make the story feel personal and warm.
- Make the lesson feel organic - never preachy.
- End with a gentle, hopeful resolution.
- Use simple, age-appropriate language.
- Begin with a creative, engaging title on the very first line, formatted as: TITLE: <title>
- Then write the full story on the following lines.`;

    const cohereResponse = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "command-a-reasoning-08-2025",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!cohereResponse.ok) {
      const errPayload = await cohereResponse.json().catch(() => null);
      return NextResponse.json(
        {
          error:
            errPayload?.message || errPayload?.error || "Story generation failed",
        },
        { status: cohereResponse.status }
      );
    }

    const data = await cohereResponse.json();
    const raw = extractCohereText(data);

    if (!raw.trim()) {
      return NextResponse.json(
        { error: "No story content returned by model" },
        { status: 502 }
      );
    }

    const lines = raw.trim().split("\n");
    const titleLine = lines.find((line) => line.startsWith("TITLE:"));
    const title = titleLine
      ? titleLine.replace("TITLE:", "").trim()
      : "A Story for You";
    const content = titleLine
      ? lines
          .filter((line) => !line.startsWith("TITLE:"))
          .join("\n")
          .trim()
      : raw.trim();

    return NextResponse.json({ title, content });
  } catch (error) {
    console.error("POST /api/story-generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate story" },
      { status: 500 }
    );
  }
}
