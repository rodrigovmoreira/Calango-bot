import Contact from '../models/Contact.js';
import BusinessConfig from '../models/BusinessConfig.js';

export const getDashboardSummary = async (req, res) => {
  try {
    const businessId = req.user.activeBusinessId;

    // 1. Get Business Config to find businessId
    const config = await BusinessConfig.findById(businessId);
    if (!config) {
      return res.json({
        pipelineValue: 0,
        openDeals: 0,
        newLeadsToday: 0,
        totalSales: 0
      });
    }

    // 2. Calculate Dates
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // 3. Aggregation
    const stats = await Contact.aggregate([
      { $match: { businessId: businessId } },
      {
        $group: {
          _id: null,
          pipelineValue: {
            $sum: {
              $cond: [
                { $not: [{ $in: ['$funnelStage', ['closed_won', 'closed_lost']] }] },
                '$dealValue',
                0
              ]
            }
          },
          openDeals: {
            $sum: {
              $cond: [
                { $not: [{ $in: ['$funnelStage', ['closed_won', 'closed_lost']] }] },
                1,
                0
              ]
            }
          },
          newLeadsToday: {
            $sum: {
              $cond: [
                { $gte: ['$createdAt', startOfDay] },
                1,
                0
              ]
            }
          },
          totalSales: {
            $sum: {
              $cond: [
                { $eq: ['$funnelStage', 'closed_won'] },
                '$dealValue',
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      pipelineValue: 0,
      openDeals: 0,
      newLeadsToday: 0,
      totalSales: 0
    };

    // Remove _id from result if present
    delete result._id;

    res.json(result);

  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ message: 'Error fetching dashboard summary' });
  }
};
