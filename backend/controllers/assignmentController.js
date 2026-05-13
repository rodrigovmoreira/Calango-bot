import Contact from '../models/Contact.js';
import Appointment from '../models/Appointment.js';
import SystemUser from '../models/SystemUser.js';

/**
 * Assign or reassign a contact to a user (admin only)
 * 
 * Request body:
 * {
 *   assignedTo: userId (string) | null (to unassign),
 *   __v: currentVersion (for optimistic concurrency)
 * }
 * 
 * Response: Updated contact with new assignedTo and assignedAt
 */
const assignContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo, __v } = req.body;
        const businessId = req.user.activeBusinessId;
        const userId = req.user.userId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        // Validate the contact exists and belongs to this business
        const contact = await Contact.findOne({ _id: id, businessId });
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        // If assignedTo is not null, validate that the user exists and belongs to the same business
        if (assignedTo !== null && assignedTo !== undefined) {
            const targetUser = await SystemUser.findById(assignedTo).select('businesses');
            if (!targetUser) {
                return res.status(400).json({ message: 'Target user not found' });
            }

            // Check if target user belongs to the same business
            const targetUserBusiness = targetUser.businesses.find(
                b => b.businessId.toString() === businessId.toString()
            );
            if (!targetUserBusiness) {
                return res.status(400).json({ message: 'Target user does not belong to this business' });
            }
        }

        // Optimistic concurrency: Check version match
        const updateData = {
            assignedTo: assignedTo || null,
            assignedAt: assignedTo ? new Date() : null
        };

        const query = { _id: id, businessId };
        if (__v !== undefined) {
            query.__v = __v;
        }

        // Update with optimistic concurrency
        const updatedContact = await Contact.findOneAndUpdate(
            query,
            { $set: updateData, $inc: { __v: 1 } },
            { new: true }
        );

        if (!updatedContact) {
            // Check if conflict was due to version mismatch
            const existingContact = await Contact.findOne({ _id: id, businessId });
            if (existingContact) {
                return res.status(409).json({ 
                    message: 'Conflict: This item has been modified by another user or process. Please reload to see the latest updates.' 
                });
            }
            return res.status(404).json({ message: 'Contact not found' });
        }

        res.json(updatedContact);
    } catch (error) {
        console.error('Error assigning contact:', error);
        res.status(500).json({ message: 'Error assigning contact' });
    }
};

/**
 * Assign or reassign an appointment to a user (admin only)
 * 
 * Request body:
 * {
 *   assignedTo: userId (string) | null (to unassign),
 *   __v: currentVersion (for optimistic concurrency)
 * }
 * 
 * Response: Updated appointment with new assignedTo and assignedAt
 */
const assignAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo, __v } = req.body;
        const businessId = req.user.activeBusinessId;

        if (!businessId) {
            return res.status(404).json({ message: 'Business configuration not found' });
        }

        // Validate the appointment exists and belongs to this business
        const appointment = await Appointment.findOne({ _id: id, businessId });
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // If assignedTo is not null, validate that the user exists and belongs to the same business
        if (assignedTo !== null && assignedTo !== undefined) {
            const targetUser = await SystemUser.findById(assignedTo).select('businesses');
            if (!targetUser) {
                return res.status(400).json({ message: 'Target user not found' });
            }

            // Check if target user belongs to the same business
            const targetUserBusiness = targetUser.businesses.find(
                b => b.businessId.toString() === businessId.toString()
            );
            if (!targetUserBusiness) {
                return res.status(400).json({ message: 'Target user does not belong to this business' });
            }
        }

        // Optimistic concurrency: Check version match
        const updateData = {
            assignedTo: assignedTo || null,
            assignedAt: assignedTo ? new Date() : null
        };

        const query = { _id: id, businessId };
        if (__v !== undefined) {
            query.__v = __v;
        }

        // Update with optimistic concurrency
        const updatedAppointment = await Appointment.findOneAndUpdate(
            query,
            { $set: updateData, $inc: { __v: 1 } },
            { new: true }
        );

        if (!updatedAppointment) {
            // Check if conflict was due to version mismatch
            const existingAppointment = await Appointment.findOne({ _id: id, businessId });
            if (existingAppointment) {
                return res.status(409).json({ 
                    message: 'Conflict: This item has been modified by another user or process. Please reload to see the latest updates.' 
                });
            }
            return res.status(404).json({ message: 'Appointment not found' });
        }

        res.json(updatedAppointment);
    } catch (error) {
        console.error('Error assigning appointment:', error);
        res.status(500).json({ message: 'Error assigning appointment' });
    }
};

export {
    assignContact,
    assignAppointment
};
