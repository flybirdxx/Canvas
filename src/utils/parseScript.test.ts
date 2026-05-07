import { describe, it, expect } from 'vitest';
import { parseScriptMarkdown } from './parseScript';

describe('parseScriptMarkdown', () => {
  it('should parse scene headings correctly', () => {
    const markdown = `
### 场 1：咖啡厅相遇
男主和女主在雨中的咖啡厅偶然相遇。

### 场 2 雨中追逐
两人在雨中狂奔。
    `.trim();

    const result = parseScriptMarkdown(markdown);
    
    expect(result).toHaveLength(2);
    expect(result[0].sceneNum).toBe(1);
    expect(result[0].title).toBe('咖啡厅相遇');
    expect(result[0].content).toBe('男主和女主在雨中的咖啡厅偶然相遇。\n');

    expect(result[1].sceneNum).toBe(2);
    expect(result[1].title).toBe('雨中追逐');
    expect(result[1].content).toBe('两人在雨中狂奔。');
  });

  it('should ignore non-matching headings', () => {
    const markdown = `
# 标题
## 场景一
### 场 3：结局
结束。
    `.trim();

    const result = parseScriptMarkdown(markdown);
    
    expect(result).toHaveLength(1);
    expect(result[0].sceneNum).toBe(3);
    expect(result[0].title).toBe('结局');
    expect(result[0].content).toBe('结束。');
  });

  it('should return empty array for empty input', () => {
    expect(parseScriptMarkdown('')).toEqual([]);
    expect(parseScriptMarkdown(null as any)).toEqual([]);
  });
});
