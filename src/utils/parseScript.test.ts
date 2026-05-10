import { describe, it, expect } from 'vitest';
import { parseScriptMarkdown, parseSceneLines } from './parseScript';

describe('parseSceneLines', () => {
  it('should parse plain dialogue: 角色：台词', () => {
    const result = parseSceneLines('老板：给我出去！');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('老板');
    expect(result[0].content).toBe('给我出去！');
    expect(result[0].lineType).toBe('dialogue');
    expect(result[0].emotion).toBeUndefined();
    expect(result[0].emotionEmoji).toBeUndefined();
  });

  it('should parse dialogue with emotion: 角色 (情绪)：台词', () => {
    const result = parseSceneLines('老板 (生气)：给我出去！');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('老板');
    expect(result[0].content).toBe('给我出去！');
    expect(result[0].lineType).toBe('dialogue');
    expect(result[0].emotion).toBe('愤怒');
    expect(result[0].emotionEmoji).toBe('😡');
  });

  it('should parse dialogue with Chinese parens: 角色（情绪）：台词', () => {
    const result = parseSceneLines('老板（开心）：干得好！');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('老板');
    expect(result[0].content).toBe('干得好！');
    expect(result[0].emotion).toBe('开心');
    expect(result[0].emotionEmoji).toBe('😊');
  });

  it('should parse action lines: [动作] 描述', () => {
    const result = parseSceneLines('[动作] 老板摔门而出');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('');
    expect(result[0].content).toBe('老板摔门而出');
    expect(result[0].lineType).toBe('action');
  });

  it('should parse environment lines: [环境] 描述', () => {
    const result = parseSceneLines('[环境] 雨越下越大');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('雨越下越大');
    expect(result[0].lineType).toBe('environment');
  });

  it('should parse multiple lines', () => {
    const content = [
      '老板 (生气)：给我出去！',
      '[动作] 老板拍桌而起',
      '员工 (恐惧)：是…是…',
    ].join('\n');

    const result = parseSceneLines(content);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('老板');
    expect(result[0].emotion).toBe('愤怒');
    expect(result[1].lineType).toBe('action');
    expect(result[2].role).toBe('员工');
    expect(result[2].emotion).toBe('恐惧');
  });

  it('should handle empty input', () => {
    expect(parseSceneLines('')).toEqual([]);
    expect(parseSceneLines(null as any)).toEqual([]);
  });

  it('should handle fallback plain text', () => {
    const result = parseSceneLines('这是一段普通的叙述文字');
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('');
    expect(result[0].content).toBe('这是一段普通的叙述文字');
    // CR-9: unrecognised lines are now 'action', not 'dialogue'
    expect(result[0].lineType).toBe('action');
  });
});

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

  it('should populate lines with structured ScriptLine array', () => {
    const markdown = `
### 场 1：办公室冲突
老板 (生气)：给我出去！
[动作] 老板拍桌而起
员工 (恐惧)：是…是…
    `.trim();

    const result = parseScriptMarkdown(markdown);
    expect(result).toHaveLength(1);
    expect(result[0].lines).toBeDefined();
    expect(result[0].lines!).toHaveLength(3);
    expect(result[0].lines![0].role).toBe('老板');
    expect(result[0].lines![0].emotion).toBe('愤怒');
    expect(result[0].lines![1].lineType).toBe('action');
    expect(result[0].lines![2].role).toBe('员工');
    expect(result[0].lines![2].emotion).toBe('恐惧');
  });

  it('should preserve preamble text before the first scene anchor', () => {
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
    // CR-2: preamble text (# 标题, ## 场景一) is now preserved in first scene
    expect(result[0].content).toBe('# 标题\n## 场景一\n结束。');
  });

  it('should return empty array for empty input', () => {
    expect(parseScriptMarkdown('')).toEqual([]);
    expect(parseScriptMarkdown(null as any)).toEqual([]);
  });
});
