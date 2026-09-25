export interface SentenceBufferOptions {
  minChunkLength?: number;
  maxChunkLength?: number;
  delimiters?: RegExp;
}

export class SentenceBuffer {
  private buffer: string = '';
  private minLength: number;
  private maxLength: number;
  private delimiters: RegExp;
  private isEnded: boolean = false;

  constructor(options?: SentenceBufferOptions) {
    this.minLength = options?.minChunkLength ?? 12;
    this.maxLength = options?.maxChunkLength ?? 200;
    this.delimiters = options?.delimiters ?? /[.!?;\n]+|(?<=[,])\s+/;
  }

  /**
   * Append a token / chunk of text from streaming LLM output.
   * Returns an array of complete sentences/phrases extracted so far.
   */
  public push(token: string): string[] {
    if (this.isEnded) {
      return [];
    }

    this.buffer += token;
    const readySentences: string[] = [];

    while (this.buffer.length >= this.minLength) {
      const match = this.buffer.search(this.delimiters);

      if (match !== -1) {
        // We found a delimiter match
        // Find end index of the delimiter
        const delimiterMatch = this.buffer.match(this.delimiters);
        const delimiterLength = delimiterMatch ? delimiterMatch[0].length : 1;
        const endIndex = match + delimiterLength;

        const sentence = this.buffer.substring(0, endIndex).trim();
        this.buffer = this.buffer.substring(endIndex).trimStart();

        if (sentence.length > 0) {
          readySentences.push(sentence);
        }
      } else if (this.buffer.length >= this.maxLength) {
        // Buffer exceeded max chunk length without punctuation, break at nearest space
        const lastSpace = this.buffer.lastIndexOf(' ');
        if (lastSpace > this.minLength) {
          const chunk = this.buffer.substring(0, lastSpace).trim();
          this.buffer = this.buffer.substring(lastSpace).trimStart();
          if (chunk.length > 0) {
            readySentences.push(chunk);
          }
        } else {
          // Force split
          const chunk = this.buffer.substring(0, this.maxLength).trim();
          this.buffer = this.buffer.substring(this.maxLength).trimStart();
          if (chunk.length > 0) {
            readySentences.push(chunk);
          }
        }
      } else {
        // Not enough punctuation or length yet
        break;
      }
    }

    return readySentences;
  }

  /**
   * Flush any remaining text in the buffer when the LLM generation finishes.
   */
  public flush(): string | null {
    this.isEnded = true;
    const remaining = this.buffer.trim();
    this.buffer = '';
    return remaining.length > 0 ? remaining : null;
  }

  /**
   * Clear buffer immediately (used on barge-in / cancellation).
   */
  public clear(): void {
    this.buffer = '';
    this.isEnded = true;
  }

  public getRawBuffer(): string {
    return this.buffer;
  }
}
