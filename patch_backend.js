const fs = require('fs');

// 1. Atualizar backend/models/Contact.js
let contactModel = fs.readFileSync('backend/models/Contact.js', 'utf8');
if (!contactModel.includes('notes: { type: String, default: \'\' }')) {
    // Isso já existe no modelo! Apenas vamos verificar.
    console.log("notes já existe no model Contact.js");
}

// 2. Atualizar backend/routes/contactRoutes.js
let contactRoutes = fs.readFileSync('backend/routes/contactRoutes.js', 'utf8');
if (!contactRoutes.includes('/bulk-delete')) {
    contactRoutes = contactRoutes.replace(
        "// Get single contact",
        "// Bulk delete contacts\nrouter.post('/bulk-delete', authenticateToken, contactController.bulkDeleteContacts);\n\n// Bulk add tags\nrouter.post('/bulk-tags', authenticateToken, contactController.bulkAddTags);\n\n// Get single contact"
    );
    contactRoutes = contactRoutes.replace(
        "router.put('/:id', authenticateToken, contactController.updateContact);",
        "router.put('/:id', authenticateToken, contactController.updateContact);\n\n// Delete contact\nrouter.delete('/:id', authenticateToken, contactController.deleteContact);"
    );
    fs.writeFileSync('backend/routes/contactRoutes.js', contactRoutes);
    console.log("contactRoutes.js updated");
}

// 3. Atualizar backend/controllers/contactController.js
let contactController = fs.readFileSync('backend/controllers/contactController.js', 'utf8');
if (!contactController.includes('const deleteContact =')) {
    const newControllers = `
const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        const deletedContact = await Contact.findOneAndDelete({ _id: id, businessId });

        if (!deletedContact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        console.error('Error deleting contact:', error);
        res.status(500).json({ message: 'Error deleting contact' });
    }
};

const bulkDeleteContacts = async (req, res) => {
    try {
        const { ids } = req.body;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No contact IDs provided' });
        }

        const result = await Contact.deleteMany({ _id: { $in: ids }, businessId });

        res.json({ message: \`\${result.deletedCount} contacts deleted successfully\` });
    } catch (error) {
        console.error('Error bulk deleting contacts:', error);
        res.status(500).json({ message: 'Error deleting contacts' });
    }
};

const bulkAddTags = async (req, res) => {
    try {
        const { ids, tags } = req.body;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No contact IDs provided' });
        }

        if (!Array.isArray(tags) || tags.length === 0) {
            return res.status(400).json({ message: 'No tags provided' });
        }

        const result = await Contact.updateMany(
            { _id: { $in: ids }, businessId },
            { $addToSet: { tags: { $each: tags } } }
        );

        res.json({ message: \`Tags added successfully to \${result.modifiedCount} contacts\` });
    } catch (error) {
        console.error('Error bulk adding tags:', error);
        res.status(500).json({ message: 'Error adding tags to contacts' });
    }
};
`;

    contactController = contactController.replace(
        "export {",
        newControllers + "\nexport {"
    );

    contactController = contactController.replace(
        "export {",
        "export {\n    deleteContact,\n    bulkDeleteContacts,\n    bulkAddTags,"
    );

    fs.writeFileSync('backend/controllers/contactController.js', contactController);
    console.log("contactController.js updated");
}
