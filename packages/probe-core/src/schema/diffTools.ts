/**
 * Direction-aware MCP tools/list schema diff (covenant semantics; re-derived).
 * Input = caller sends; output = caller receives — same structural change can flip severity.
 */

import {
  enumSet,
  normalizeTools,
  propertiesOf,
  requiredSet,
  typeSet,
  type ToolDefinition,
} from './normalize';

export type ChangeSeverity = 'breaking' | 'info' | 'patch';

export interface SchemaChange {
  severity: ChangeSeverity;
  code: string;
  path: string;
  detail: string;
}

export interface DiffResult {
  breaking: SchemaChange[];
  info: SchemaChange[];
  patch: SchemaChange[];
  changes: SchemaChange[];
}

type Dir = 'input' | 'output';

function bag(changes: SchemaChange[]): DiffResult {
  return {
    breaking: changes.filter((c) => c.severity === 'breaking'),
    info: changes.filter((c) => c.severity === 'info'),
    patch: changes.filter((c) => c.severity === 'patch'),
    changes,
  };
}

function push(
  out: SchemaChange[],
  severity: ChangeSeverity,
  code: string,
  path: string,
  detail: string,
): void {
  out.push({ severity, code, path, detail });
}

function diffSchema(
  path: string,
  oldS: Record<string, unknown> | undefined,
  newS: Record<string, unknown> | undefined,
  dir: Dir,
  out: SchemaChange[],
): void {
  if (!oldS && !newS) return;
  if (!oldS && newS) {
    push(
      out,
      dir === 'input' ? 'breaking' : 'info',
      dir === 'input' ? 'schema.input.added' : 'schema.output.added',
      path,
      `${dir} schema was added`,
    );
    return;
  }
  if (oldS && !newS) {
    push(
      out,
      dir === 'input' ? 'breaking' : 'breaking',
      dir === 'input' ? 'schema.input.removed' : 'schema.output.removed',
      path,
      `${dir} schema was removed`,
    );
    // Output schema remove is breaking (covenant); input whole-schema remove also breaks callers.
    if (dir === 'input') {
      /* already breaking */
    }
    return;
  }
  if (!oldS || !newS) return;

  const ot = typeSet(oldS);
  const nt = typeSet(newS);
  if (ot && nt) {
    const removed = [...ot].filter((x) => !nt.has(x));
    const added = [...nt].filter((x) => !ot.has(x));
    if (removed.length || added.length) {
      const breaking =
        dir === 'input' ? removed.length > 0 : added.length > 0;
      push(
        out,
        breaking ? 'breaking' : 'info',
        'schema.type.changed',
        path,
        `type changed ${[...ot]} → ${[...nt]}`,
      );
    }
  }

  const oe = enumSet(oldS);
  const ne = enumSet(newS);
  if (oe && ne) {
    const removed = [...oe].filter((x) => !ne.has(x)).length;
    const added = [...ne].filter((x) => !oe.has(x)).length;
    if (removed > 0) {
      push(
        out,
        dir === 'input' ? 'breaking' : 'info',
        'schema.enum.value.removed',
        path,
        `${removed} enum value(s) removed`,
      );
    }
    if (added > 0) {
      push(
        out,
        dir === 'output' ? 'breaking' : 'info',
        'schema.enum.value.added',
        path,
        `${added} enum value(s) added`,
      );
    }
  } else if (oe && !ne) {
    push(
      out,
      dir === 'output' ? 'breaking' : 'info',
      'schema.enum.removed',
      path,
      'enum constraint removed',
    );
  } else if (!oe && ne) {
    push(
      out,
      dir === 'input' ? 'breaking' : 'info',
      'schema.enum.added',
      path,
      'enum constraint added',
    );
  }

  const oldClosed = oldS.additionalProperties === false;
  const newClosed = newS.additionalProperties === false;
  if (dir === 'input' && !oldClosed && newClosed) {
    push(
      out,
      'breaking',
      'schema.additionalProperties.restricted',
      path,
      'additionalProperties tightened to false',
    );
  }

  const op = propertiesOf(oldS);
  const np = propertiesOf(newS);
  const oldReq = requiredSet(oldS);
  const newReq = requiredSet(newS);
  const names = new Set([...Object.keys(op), ...Object.keys(np)]);

  for (const name of names) {
    const ppath = `${path}.properties.${name}`;
    const was = name in op;
    const is = name in np;
    if (!was && is) {
      const newlyReq = newReq.has(name) && !oldReq.has(name);
      const sev: ChangeSeverity =
        dir === 'input' && newlyReq ? 'breaking' : 'info';
      push(
        out,
        sev,
        newlyReq ? 'schema.property.required.added' : 'schema.property.added',
        ppath,
        newlyReq ? 'new required property' : 'new optional property',
      );
      continue;
    }
    if (was && !is) {
      const wasRequired = oldReq.has(name);
      let sev: ChangeSeverity;
      if (dir === 'output') sev = 'breaking';
      else sev = wasRequired ? 'breaking' : 'info';
      push(
        out,
        sev,
        'schema.property.removed',
        ppath,
        `${wasRequired ? 'required' : 'optional'} property removed`,
      );
      continue;
    }
    const wasReq = oldReq.has(name);
    const nowReq = newReq.has(name);
    if (!wasReq && nowReq) {
      push(
        out,
        dir === 'input' ? 'breaking' : 'info',
        'schema.property.required.added',
        ppath,
        'property became required',
      );
    } else if (wasReq && !nowReq) {
      push(
        out,
        dir === 'input' ? 'info' : 'breaking',
        'schema.property.required.relaxed',
        ppath,
        'property is no longer required',
      );
    }
    diffSchema(
      ppath,
      op[name] as Record<string, unknown>,
      np[name] as Record<string, unknown>,
      dir,
      out,
    );
  }
}

/**
 * Diff two tools/list snapshots. Pure — no I/O.
 */
export function diffTools(
  previous: ToolDefinition[],
  current: ToolDefinition[],
): DiffResult {
  const out: SchemaChange[] = [];
  const prev = new Map(normalizeTools(previous).map((t) => [t.name, t]));
  const curr = new Map(normalizeTools(current).map((t) => [t.name, t]));
  const names = new Set([...prev.keys(), ...curr.keys()]);

  for (const name of names) {
    const before = prev.get(name);
    const after = curr.get(name);
    const base = `tool:${name}`;

    if (!before && after) {
      push(out, 'info', 'tool.added', base, 'new tool');
      continue;
    }
    if (before && !after) {
      push(out, 'breaking', 'tool.removed', base, 'tool was removed');
      continue;
    }
    if (!before || !after) continue;

    if ((before.description ?? '') !== (after.description ?? '')) {
      push(out, 'patch', 'tool.description.changed', base, 'description changed');
    }
    if ((before.title ?? '') !== (after.title ?? '')) {
      push(out, 'patch', 'tool.title.changed', base, 'title changed');
    }

    diffSchema(
      `${base} → inputSchema`,
      before.inputSchema,
      after.inputSchema,
      'input',
      out,
    );

    const bo = before.outputSchema;
    const ao = after.outputSchema;
    if (!bo && ao) {
      push(out, 'info', 'tool.output_schema.added', base, 'outputSchema added');
    } else if (bo && !ao) {
      push(out, 'breaking', 'tool.output_schema.removed', base, 'outputSchema removed');
    } else if (bo && ao) {
      diffSchema(`${base} → outputSchema`, bo, ao, 'output', out);
    }
  }

  return bag(out);
}
