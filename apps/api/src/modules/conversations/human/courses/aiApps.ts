import type { Curriculum } from './types.js';

/** Building LLM apps, zero to advanced. Model names, prices and free tiers change — always point to the provider's current docs. */
export const aiApps: Curriculum = {
  id: 'ai-apps',
  name: 'AI / LLM app development',
  match: /\b(llm|genai|gen ai|generative ai|rag|ai agents?|agents|ai apps?|prompt engineering|mcp|langchain|ai engineering)\b/i,
  codeLang: 'python',
  docs: 'ai.google.dev/gemini-api/docs (free tier for learners) and the provider docs you use',
  before: 'Python (or JavaScript) through functions, dictionaries, files, pip/venv and HTTP APIs',
  levels: [
    {
      title: 'Start',
      lessons: [
        {
          title: 'What LLMs are',
          topics: ['what a large language model does (predicts the next token)', 'tokens, context window, temperature', 'what LLMs are good and bad at (hallucination)', 'chat apps vs APIs'],
        },
        {
          title: 'Your first API call',
          topics: ['getting a free Gemini API key from Google AI Studio (limits change)', 'API keys in environment variables, never in code', 'pip install google-genai and a first generate_content call', 'reading the response and handling errors / rate limits'],
        },
      ],
      project: 'a command-line chatbot that keeps the conversation history',
    },
    {
      title: 'Prompting',
      lessons: [
        {
          title: 'Prompt basics',
          topics: ['system instructions vs user messages', 'clear instructions, examples (few-shot)', 'asking for a format', 'iterating on a prompt with test inputs'],
        },
        {
          title: 'Structured output',
          topics: ['asking for JSON', 'JSON schema / structured output support', 'validating model output (pydantic / zod) and retrying'],
        },
        {
          title: 'Costs and limits',
          topics: ['counting tokens', 'max output tokens and cost control', 'streaming responses', 'caching and choosing smaller models'],
        },
      ],
      project: 'a resume or review analyser that returns validated JSON (skills, score, 3 suggestions)',
    },
    {
      title: 'RAG',
      lessons: [
        {
          title: 'Embeddings',
          topics: ['what an embedding is (meaning as numbers)', 'cosine similarity', 'creating embeddings with an API'],
        },
        {
          title: 'Building RAG',
          topics: ['loading documents (PDF, text)', 'chunking with overlap', 'storing vectors (in memory → a vector database like pgvector or Chroma)', 'retrieving top-k chunks', 'a prompt that answers only from the chunks and says "I don’t know"', 'citing sources'],
        },
        {
          title: 'Better retrieval',
          topics: ['chunk size trade-offs', 'hybrid search (keywords + vectors)', 're-ranking', 'metadata filters'],
        },
      ],
      project: 'a "chat with your PDF" app that answers 10 test questions correctly with sources',
    },
    {
      title: 'Tools and agents',
      lessons: [
        {
          title: 'Function calling',
          topics: ['what tool / function calling is', 'defining a tool schema', 'running the tool and sending the result back', 'validating tool inputs'],
        },
        {
          title: 'Agents',
          topics: ['the agent loop (think → call tool → observe)', 'capping steps and stopping loops', 'logging every tool call', 'when a simple workflow beats an agent'],
        },
        {
          title: 'MCP',
          topics: ['what the Model Context Protocol is', 'MCP servers and clients', 'building a tiny MCP server (check the current SDK docs)'],
        },
      ],
      project: 'an agent with 2–3 tools (e.g. weather + calculator + notes) that logs its steps and never loops forever',
    },
    {
      title: 'Production AI apps',
      lessons: [
        {
          title: 'Evals',
          topics: ['why vibes are not enough', 'a fixed test set with expected answers', 'automatic checks and LLM-as-judge (with care)', 'tracking scores when you change prompts or models'],
        },
        {
          title: 'Safety and security',
          topics: ['prompt injection and untrusted content', 'never running model output blindly', 'protecting keys and user data', 'content moderation'],
        },
        {
          title: 'Shipping',
          topics: ['a web UI (Streamlit / React) and a backend API', 'rate limits, retries and fallbacks', 'logging and monitoring costs', 'deploying (check current host limits)'],
        },
      ],
      project: 'final project: a deployed RAG or agent app with evals, a README and a demo video',
    },
  ],
};
