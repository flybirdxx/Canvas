export {
  analyzeVideoToOmniScript,
  buildOmniScriptTextRequest,
  OMNISCRIPT_SYSTEM_PROMPT,
  parseOmniScriptResult,
} from './omniscript/index';

export type {
  AnalyzeVideoToOmniScriptOptions,
  OmniScriptAnalysisResult,
  OmniScriptHighlight,
  OmniScriptParseResult,
  OmniScriptResult,
  OmniScriptSegment,
  OmniScriptStructuredLine,
} from './omniscript/index';
