import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

/** Splits `inline code` out of a chat text so it shows as code, not as raw backticks. */
export function splitInlineCode(text: string): Array<{ code: boolean; text: string }> {
  const parts: Array<{ code: boolean; text: string }> = [];
  let last = 0;
  for (const m of text.matchAll(/`([^`\n]+)`/g)) {
    if (m.index! > last) parts.push({ code: false, text: text.slice(last, m.index) });
    parts.push({ code: true, text: m[1]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ code: false, text: text.slice(last) });
  return parts;
}

export function withInlineCode(text: string, codeStyle: StyleProp<TextStyle>): React.ReactNode {
  const parts = splitInlineCode(text);
  if (!parts.some((p) => p.code)) return text;
  return parts.map((p, i) =>
    p.code ? (
      <Text key={i} style={codeStyle}>
        {` ${p.text} `}
      </Text>
    ) : (
      p.text
    ),
  );
}
