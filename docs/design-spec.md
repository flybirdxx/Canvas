# Design Spec

## Canvas First

The first screen is the working canvas. Navigation chrome stays lightweight and avoids mode switches. Users add nodes from the dock, connect ports, and run selected generation subgraphs.

## OmniScript Node

OmniScript is a canvas tool node for video cover analysis.

- Header: tool name, text model selector, analyze button.
- Inputs: video URL, optional analysis notes, optional upstream video/file connection.
- Output: three equal columns:
  - 分段剧情概述
  - 结构化剧本
  - 高光时刻
- Error state: show provider/model unsupported video understanding clearly.

## Removed UX

The app no longer exposes a storyboard mode, scene cards, script containers, storyboard batch execution, or storyboard MP4 export.
