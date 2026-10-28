// Regras de vínculo (membership) usuário ↔ empresa.
//
// Um usuário pode participar de várias empresas, mas cada vínculo tem seu
// próprio status. A inativação é sempre do VÍNCULO — nunca do usuário — para
// preservar o histórico de onde a pessoa passou (ver ADR 004).
//
// Compatibilidade: vínculos criados antes deste campo existir não têm `status`.
// Ausência de `status` significa ATIVO.

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

export const isActiveMembership = (membership) =>
  membership?.status !== MEMBERSHIP_STATUS.INACTIVE;

export const activeMemberships = (user) =>
  (user?.businesses || []).filter(isActiveMembership);

// Formato exposto ao frontend: apenas vínculos ativos, com o nome da empresa.
// Vínculo inativo não aparece no seletor de empresas.
export const formatBusinesses = (memberships = []) =>
  memberships.filter(isActiveMembership).map((b) => ({
    businessId: {
      _id: b.businessId?._id ? b.businessId._id.toString() : b.businessId?.toString(),
      businessName: b.businessId?.businessName || 'Empresa'
    },
    role: b.role || 'operator'
  }));

// Cláusula Mongo para "vínculo ativo nesta empresa" (tolerante a docs legados).
export const activeMembershipQuery = (businessId, extra = {}) => ({
  businesses: {
    $elemMatch: {
      businessId,
      status: { $ne: MEMBERSHIP_STATUS.INACTIVE },
      ...extra
    }
  }
});
