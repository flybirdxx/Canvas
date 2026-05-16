# Canvas V1 Planning Loop Design

## Goal

V1 builds a canvas-first short-drama planning loop for deep creators.

The product should help a creator turn one rough idea into a production-ready planning structure:

1. Project seed
2. Story bible
3. Character production packages
4. Plot nodes
5. Necessary material requirements
6. Confirmed production task nodes

The V1 success condition is not high-quality image or video generation. The success condition is that an idea becomes editable canvas structure and then becomes production task nodes that can later be converted into concrete generation nodes.

## Product Position

Canvas is the primary interface. The app should not behave like a document generator with a canvas attached. Planning entities, story structure, characters, props, scenes, plot beats, and tasks should appear as canvas objects first. Side panels may expose details, but they should not replace the canvas as the main workspace.

AI assists with first-pass structure. The user remains the final decision maker for confirmation, deletion, merging, task type, and production readiness.

## V1 Scope

V1 includes:

- A project seed node for one idea and minimal direction.
- A story bible node generated from the project seed.
- Character production package nodes generated from the story bible.
- Plot nodes organized around key events, turns, secret reveals, and relationship changes.
- AI-inferred material requirements under each plot node.
- User confirmation, deletion, and merging before material requirements become task nodes.
- Production task nodes that reference character, scene, and prop nodes through canvas connections.
- AI-recommended task type with user confirmation.
- Optional copy-conversion from a task node to a concrete generation node.
- Prop visual conflict prompts for key props.
- Basic prop visual definition and plot-node generation state, focused first on prop visibility.

V1 excludes:

- A complete asset library system.
- Character turnaround sheets and character visual-stability workflows.
- Full automatic workflow generation.
- Multi-user collaboration.
- A complete storyboard system.
- Video generation quality loops.
- Complex worldbuilding databases.
- Training, LoRA, fine-tuning, or model-adaptation asset management.
- Complete execution snapshots and reproduction history.

## Core Flow

1. The user creates a project seed node on the canvas and enters one idea plus optional direction.
2. The user selects the short-drama project template.
3. AI generates a story bible node with world setup, main conflict, key characters, and key plot nodes.
4. AI extracts character production package nodes from the story bible.
5. AI generates plot nodes. Each plot node represents a key event, turn, secret reveal, or relationship change.
6. AI infers necessary material requirements under each plot node: characters, scenes, and props.
7. The user confirms, deletes, or merges material requirements.
8. Confirmed requirements become production task nodes.
9. Production task nodes connect to relevant character, scene, and prop nodes.
10. When production starts, the user can copy-convert a task node into a concrete image, text, video, or audio generation node. The original task node remains as the planning source.

## Canvas Object Model

### Project Seed Node

The project seed node stores the original idea, genre, tone, and short-drama direction. It is the source for story bible generation.

### Story Bible Node

The story bible node stores structured planning output:

- World setup
- Main conflict
- Main characters
- Key plot nodes
- Basis for short-drama template recommendations

It is editable and should remain connected to downstream planning nodes.

### Character Production Package Node

The character production package is not primarily a visual asset in V1. Its first priority is narrative production.

The core field is plot responsibility: what this character provides to downstream production at important plot nodes.

Character package fields focus first on:

- Character goal
- Conflict function
- Plot responsibility
- Character arc

V1 should make plot responsibility the deepest field. It should describe what downstream script, shot, material, or task needs arise because of this character at each key plot node.

### Plot Node

Plot nodes are organized by key events, turns, secret reveals, and relationship changes. They are not full scene cards in V1.

Each plot node can contain AI-inferred material requirements. These requirements are filtered by production necessity: only materials required for downstream generation execution or output control should be listed.

### Character, Scene, and Prop Reference Nodes

V1 does not need a complete asset library, but it needs referenceable planning objects for characters, scenes, and props.

These objects should be connectable to task nodes. Task nodes should use connections to resolve context instead of copying free text.

### Production Task Node

A production task node is a production specification card on the canvas.

It includes:

- Title
- Material type
- Visual or content description
- Character, scene, and prop references through canvas connections
- Recommended model or node type
- Acceptance criteria

The most important field is its structured reference to character, scene, and prop objects. A task node should not be treated as an isolated prompt.

## AI Behavior

### Structure Generation

AI can generate the first story bible, character production packages, and plot nodes. These outputs must become editable canvas objects.

### Restrained Material Inference

For each plot node, AI infers material requirements only when they are necessary for production. The main failure mode to avoid is listing too many low-value materials.

The filtering rule is production necessity:

If the material is missing, downstream AI generation cannot execute correctly or quality becomes hard to control.

### User Confirmation

AI-generated material requirements remain pending until the user confirms them. The user can delete, edit, or merge them before they become task nodes.

Task type is AI-recommended and user-confirmed. Examples include image, text, video, and audio.

### Conflict Handling

V1 conflict handling focuses on key prop visual conflicts.

If a task description conflicts with a prop's visual definition, such as appearance, color, material, or identifying mark, the system should show a conflict prompt and ask the user to choose which side wins.

## Prop Handling

Key props are both story devices and visual anchors.

V1 uses a prop reference object plus plot-node state:

- The prop reference object defines baseline appearance, material, color, and identifying marks.
- The plot node records how the prop should appear in the current production context.

The first plot-node prop state field is visibility:

- Fully visible
- Partially visible
- Obscured
- Identifying mark only

AI can recommend visibility based on plot purpose, but the user confirms it.

## Task Conversion

Production task nodes default to planning specifications.

When the user wants to execute production, the task node is copy-converted into a concrete generation node. The original task node remains in place and stays connected to the planning structure. The generated execution node is placed nearby and automatically connected back to the source task node.

Concrete execution node type follows task type:

- Image task to image generation node
- Text task to text generation node
- Video task to video generation node when available
- Audio task to audio generation node when available

V1 may support conversion without making all execution paths equally mature.

## Context Resolution

Execution nodes receive structured references and task purpose from the source task node.

Priority rule:

The task node description determines what this specific generation needs. Character, scene, and prop references provide constraints and continuity.

If a task description clearly conflicts with a referenced planning object, the system should prompt the user before execution.

## Experience Principles

- AI turns disorder into structure.
- The canvas makes structure visible, editable, and connectable.
- The user controls final production judgment.
- Planning intent is not overwritten by execution results.
- V1 should stay narrow enough to build a complete planning loop.

## Open Implementation Questions

- Whether project seed, story bible, plot, character package, prop, and task should all be new canvas element types, or whether some should start as typed variants of a generic planning node.
- How much of the story bible should be stored as structured fields versus rich editable text.
- Whether material requirements should exist as inline pending items inside plot nodes before confirmation, or as lightweight pending nodes.
- How task conversion should map to existing image, text, video, and audio node types.
- Where conflict prompts should appear: inline on the task node, in the properties panel, or as a modal confirmation.
