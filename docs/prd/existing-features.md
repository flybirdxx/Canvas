# Existing Features

## Node Types

| Type | Purpose | Inputs | Outputs |
| --- | --- | --- | --- |
| `text` | Prompt or note text | - | text |
| `sticky` | Quick note | any | any |
| `image` | Image generation or uploaded image | text, image | image |
| `video` | Video generation or uploaded video | image | video |
| `audio` | Audio generation or uploaded audio | text | audio |
| `file` | General attachment | - | media output when MIME is supported |
| `rectangle` / `circle` | Layout shapes | any | any |
| `omniscript` | Video cover analysis and rewriting reference | video | text |
| `aigenerating` | Transient placeholder | - | - |

## OmniScript

OmniScript accepts a video URL or an upstream video/file node. It calls the configured LLM/provider with video context and displays:

- 分段剧情概述
- 结构化剧本
- 高光时刻

Providers that cannot analyze video must return an unsupported error.

## Removed Features

`scene`, `script`, Storyboard view, batch scene execution, scene synchronization, and storyboard MP4 export have been removed.
