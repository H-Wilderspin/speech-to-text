export const repository = 'H-Wilderspin/speech-to-text-meals';
export const repositoryUrl = `https://github.com/${repository}`;
const api = `https://api.github.com/repos/${repository}/contents/`;
const raw = `https://raw.githubusercontent.com/${repository}/main/`;
const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  } catch {
    throw new Error('Could not reach GitHub. Check your connection and try again.');
  }
  if (response.status === 401) throw new Error('GitHub access expired or is invalid. In Settings, use Disconnect GitHub, then connect a new token.');
  if (response.status === 403 || response.status === 429) throw new Error('GitHub denied this request. Check write access, or wait if its request limit was reached.');
  return response;
}

// Public readers never send credentials; authenticated reads return the SHA
// needed for conditional writes. Only explicit data paths from adapters are used.
export async function readJsonFile(path: string, token = ''): Promise<{ value?: unknown; sha?: string }> {
  const response = await request(token ? `${api}${path}?ref=main` : `${raw}${path}?updated=${Date.now()}`,
    token ? { headers: { ...headers, Authorization: `Bearer ${token}` } } : undefined);
  if (response.status === 404) return {};
  if (!response.ok) throw new Error('Could not load the latest plan. Try again.');
  if (!token) return { value: await response.json() };
  const file = await response.json() as { sha: string; content: string; encoding: string };
  if (file.encoding !== 'base64' || !file.sha) throw new Error('Could not read the saved plan.');
  const decoded = new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0)));
  return { sha: file.sha, value: JSON.parse(decoded) };
}

export async function writeJsonFile(path: string, value: unknown, sha: string | undefined, token: string, message: string): Promise<Response> {
  if (!token) throw new Error('Connect GitHub in Settings to edit.');
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n');
  const content = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
  return request(`${api}${path}`, { method: 'PUT', headers: { ...headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, branch: 'main', sha, content }),
  });
}

export async function checkEditor(token: string): Promise<string> {
  const response = await request(`https://api.github.com/repos/${repository}`, { headers: { ...headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('This GitHub account cannot access the planner repository.');
  const data = await response.json() as { permissions?: { push?: boolean } };
  if (!data.permissions?.push) throw new Error('This GitHub account needs write access to the planner repository.');
  return token;
}
