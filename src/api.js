const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchNote() {
    const response = await fetch(`${API_URL}/note`);
    if (!response.ok) {
        throw new Error(`Erro ao carregar nota: ${response.status}`);
    }
    return response.json();
}

export async function saveNote(content, version) {
    const response = await fetch(`${API_URL}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, version }),
    });

    const data = await response.json();

    if (!response.ok) {
        const error = new Error(data.error || `Erro ao salvar: ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}
