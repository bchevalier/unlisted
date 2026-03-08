'use client';

type SettingsPanelProps = {
  door: {
    slug: string;
    displayName: string;
    settings:
      | {
          autoReplyEnabled: boolean;
          autoReplyMessage: string | null;
          weeklyRequestCap: number | null;
          revealMethod: 'NONE' | 'EMAIL' | 'URL';
          revealValue: string | null;
        }
      | null;
    categories: Array<{
      key: string;
      label: string;
      isEnabled: boolean;
      weeklyCap: number | null;
      fields: Array<{
        key: string;
        label: string;
        required: boolean;
      }>;
    }>;
  };
};

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? 'Request failed');
  }
}

export function SettingsPanel({ door }: SettingsPanelProps) {
  return (
    <section className="settings-panel">
      <article className="settings-card">
        <h2>Door settings</h2>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);

            await postJson('/api/direct/settings/door', {
              doorSlug: door.slug,
              autoReplyEnabled: data.get('autoReplyEnabled') === 'on',
              autoReplyMessage: String(data.get('autoReplyMessage') ?? '').trim() || null,
              weeklyRequestCap: data.get('weeklyRequestCap')
                ? Number(data.get('weeklyRequestCap'))
                : null,
              revealMethod: String(data.get('revealMethod') ?? 'NONE'),
              revealValue: String(data.get('revealValue') ?? '').trim() || null
            });

            alert('Door settings saved');
          }}
        >
          <label>
            <input
              type="checkbox"
              name="autoReplyEnabled"
              defaultChecked={door.settings?.autoReplyEnabled ?? false}
            />{' '}
            Auto-reply enabled
          </label>

          <label>
            Auto-reply message
            <textarea
              name="autoReplyMessage"
              rows={3}
              defaultValue={door.settings?.autoReplyMessage ?? ''}
            />
          </label>

          <label>
            Weekly request cap (global)
            <input
              name="weeklyRequestCap"
              type="number"
              min={1}
              defaultValue={door.settings?.weeklyRequestCap ?? ''}
            />
          </label>

          <label>
            Contact reveal method
            <select name="revealMethod" defaultValue={door.settings?.revealMethod ?? 'NONE'}>
              <option value="NONE">None</option>
              <option value="EMAIL">Email</option>
              <option value="URL">URL</option>
            </select>
          </label>

          <label>
            Contact reveal value
            <input name="revealValue" type="text" defaultValue={door.settings?.revealValue ?? ''} />
          </label>

          <button type="submit">Save door settings</button>
        </form>
      </article>

      <article className="settings-card">
        <h2>Categories</h2>
        <div className="settings-categories">
          {door.categories.map((category) => (
            <section key={category.key} className="settings-category">
              <h3>{category.label}</h3>
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);

                  await postJson('/api/direct/settings/category', {
                    doorSlug: door.slug,
                    categoryKey: category.key,
                    isEnabled: data.get('isEnabled') === 'on',
                    weeklyCap: data.get('weeklyCap') ? Number(data.get('weeklyCap')) : null
                  });

                  alert(`Saved category: ${category.label}`);
                }}
              >
                <label>
                  <input type="checkbox" name="isEnabled" defaultChecked={category.isEnabled} /> Enabled
                </label>

                <label>
                  Weekly cap
                  <input name="weeklyCap" type="number" min={1} defaultValue={category.weeklyCap ?? ''} />
                </label>

                <button type="submit">Save category</button>
              </form>

              {category.fields.length > 0 ? (
                <div className="settings-fields">
                  <h4>Required fields</h4>
                  {category.fields.map((field) => (
                    <form
                      key={field.key}
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        const data = new FormData(form);

                        await postJson('/api/direct/settings/field', {
                          doorSlug: door.slug,
                          categoryKey: category.key,
                          fieldKey: field.key,
                          required: data.get('required') === 'on'
                        });

                        alert(`Saved field: ${field.label}`);
                      }}
                    >
                      <label>
                        <input type="checkbox" name="required" defaultChecked={field.required} /> {field.label}
                      </label>
                      <button type="submit">Save field</button>
                    </form>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}
