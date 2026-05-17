# Planning Console With Existing Nodes Design

## Goal

Refine the current short-drama planning flow so that `planning` is no longer a broad business node type or task node system.

The new direction keeps the planning workflow the user likes, but returns content, execution, billing, model selection, and generation responsibilities to the existing mature node types:

- `text`
- `image`
- `video`
- `audio`
- `file`
- `omniscript`

The success condition is a clearer responsibility boundary:

- `planning` organizes and guides the flow.
- Existing nodes hold content and execute work.
- The existing execution and billing paths remain the source of truth.

## Chosen Approach

Use **Planning Console + Existing Nodes**.

`planning` remains as a lightweight project console. It is not removed, but it stops acting as the primary carrier for story bible, plot, character package, reference, or production task content.

The console creates and organizes existing nodes. Execution always happens through existing executable node types after user confirmation.

## Planning Node Role

The `planning` node is responsible for:

- Starting a short-drama planning project from a seed.
- Showing project flow state.
- Offering next-step actions such as generating structure, identifying missing references, or creating draft execution nodes.
- Tracking project grouping and generated batches.
- Acting as a visible control point on the canvas.

The `planning` node is not responsible for:

- Holding story bible, plot, character, prop, or scene content as the main source of truth.
- Creating new `planning productionTask` nodes in the new flow.
- Running AI generation.
- Entering the execution queue.
- Triggering billing.
- Owning model settings, generation parameters, queue state, or provider-specific behavior.

## Existing Node Mapping

Generated planning structure maps to existing node types:

- Story bible -> `text`
- Plot / beat / key event -> `text`
- Character reference -> usually `text`, optionally `image` or `file` when visual assets exist
- Prop reference -> usually `text`, optionally `image` or `file`
- Scene reference -> usually `text`, optionally `image` or `file`
- Production task -> direct `image`, `text`, `video`, or `audio` execution node
- Video cover analysis -> `omniscript`

This keeps the canvas understandable without inventing a parallel planning-only execution model.

## Relationships

Use different mechanisms for different meanings:

- **Group** means project ownership: these nodes belong to the same planning project.
- **Connection** means execution context: this upstream node contributes text or media context to a downstream execution node.
- **Local node prompt/body** means the immediate task goal: the node remains understandable even without inspecting upstream context.

Planning console nodes may display group state, but they should not force all project ownership relationships into prompt-flow connections.

## Task Creation

The new `创建任务` behavior creates existing execution nodes directly.

Examples:

- Image material requirement -> `image` node
- Script or copy requirement -> `text` node
- Video requirement -> `video` node
- Audio, voice, BGM, or sound requirement -> `audio` node

The created node contains:

- A short local prompt/body describing this task.
- Connections to relevant story, plot, character, prop, scene, image, or file context nodes.
- Draft metadata that records its planning origin.

The flow no longer creates a `planning productionTask` node for new tasks.

## Draft Review Metadata

Add a generic draft metadata field to executable nodes created by the planning console:

```ts
planningDraft?: {
  sourcePlanningId: string;
  sourceRequirementId?: string;
  projectId?: string;
  status: 'pendingReview' | 'approved';
}
```

This metadata should be available on existing executable node types rather than creating a new planning task node type.

The initial status is `pendingReview`.

Pending review nodes:

- Can be edited.
- Can be moved.
- Can be connected.
- Can be deleted.
- Cannot run.
- Cannot enter billing or provider execution.

After the user confirms the node, status becomes `approved`. From that point forward, the node follows the existing execution, billing, queue, and provider paths.

## Execution Guard

Execution should be blocked for nodes with:

```ts
planningDraft.status === 'pendingReview'
```

The user-facing message should be clear and Chinese:

```text
此节点来自规划，确认后才能执行
```

This guard belongs at the execution boundary so it protects all run entry points, not only a single button.

The guard must not create a planning-specific execution path. Once a draft is approved, execution should behave exactly like an ordinary existing node.

## Data Flow

The main flow is:

1. User creates a `planning` console node.
2. User enters the project seed.
3. User clicks a planning action such as `生成规划结构`.
4. AI returns structured planning output.
5. The system materializes the output as existing nodes.
6. Nodes are grouped as one project.
7. Context-producing nodes are connected to downstream execution nodes only when they should influence generation.
8. Draft execution nodes are created with `planningDraft.status === 'pendingReview'`.
9. User confirms an execution node.
10. Existing execution engine, billing, model selection, and queue behavior take over.

## Service Boundaries

`src/services/planning.ts` can remain responsible for:

- Prompt construction
- Gateway text call
- JSON parsing
- Normalization

The current `planningGraph` concept should be narrowed or renamed in implementation planning. Its new responsibility is materializing planning output into existing canvas nodes, groups, connections, and draft metadata.

`flowResolver` remains responsible for resolving execution context from existing canvas connections.

`executionEngine` should only need a generic draft guard. It should not understand story bible, plot, prop, scene, or planning workflow internals.

## Error Handling

Planning generation failure:

- Show the error on the planning console.
- Do not create partial nodes.

Partial materialization failure:

- Keep already-created nodes only if they are internally consistent.
- Avoid duplicate creation on retry by using stable source IDs or draft metadata.

Draft execution attempt:

- Block execution.
- Show `此节点来自规划，确认后才能执行`.

Missing upstream context:

- Keep the local prompt/body.
- Surface a non-blocking warning that planning context is missing.

Provider or billing failures:

- Continue using existing error contracts from the mature node execution paths.

## Compatibility

Do not force-migrate existing user canvases.

Existing planning subtypes remain readable and editable:

- `storyBible`
- `plot`
- `characterPackage`
- `reference`
- `productionTask`

Existing `planning productionTask` nodes keep their old copy-conversion behavior for compatibility.

New flows should stop creating `planning productionTask` nodes.

The UI may label old production task cards as legacy planning task cards later, but V1 of this redesign should avoid destructive migration.

## Visual Rules

The planning console should feel like a light workflow panel, not a heavy execution node.

Execution nodes created from planning should look like their normal node type, with a subtle draft indicator such as:

```text
来自规划 · 待确认
```

The confirmation affordance should live near the existing input/execution controls rather than creating a new planning-specific toolbar.

## Testing Requirements

Implementation should include tests for:

- Creating a planning console node.
- Generating planning output as existing nodes, not planning subnodes.
- Grouping generated nodes into the same project.
- Connecting only context that should affect execution.
- Creating direct execution nodes from requirements.
- Applying `planningDraft.status === 'pendingReview'`.
- Blocking execution while pending review.
- Allowing execution after approval.
- Preserving existing normal execution behavior for ordinary nodes.
- Keeping legacy planning nodes displayable.
- Keeping legacy `planning productionTask` conversion behavior for existing data.

Browser verification should cover:

- Planning console creation.
- Structure generation creates existing nodes.
- Requirement task creation creates existing executable nodes.
- Pending review blocks execution with clear Chinese copy.
- Approval returns the node to the normal execution path.

## Non-Goals

This redesign does not add:

- A full asset library system.
- A new billing model.
- A new execution engine.
- A new provider pathway.
- A new storyboard system.
- Automatic migration of existing planning subnodes.

## Open Implementation Decisions

The implementation plan should decide:

- Exact type location for `planningDraft`.
- Whether `projectId` should reuse group ID or be a separate stable ID.
- Whether the materializer keeps the `planningGraph` filename or moves to a clearer name.
- Where the confirmation UI appears for each executable node type.
- How to prevent duplicate materialization on retry.
