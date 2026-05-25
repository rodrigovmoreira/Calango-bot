const fs = require('fs');

let apiContent = fs.readFileSync('frontend/src/services/api.js', 'utf8');

if (!apiContent.includes('deleteContact: (id)')) {
    apiContent = apiContent.replace(
        "updateContact: (id, data) => api.put(`/api/contacts/${id}`, data),",
        "updateContact: (id, data) => api.put(`/api/contacts/${id}`, data),\n  deleteContact: (id) => api.delete(`/api/contacts/${id}`),\n  bulkDeleteContacts: (ids) => api.post('/api/contacts/bulk-delete', { ids }),\n  bulkAddTags: (ids, tags) => api.post('/api/contacts/bulk-tags', { ids, tags }),"
    );
    fs.writeFileSync('frontend/src/services/api.js', apiContent);
    console.log("api.js updated");
}
