# Roadmap

This document tracks the planned features and improvements for the Next.js SaaS Boilerplate.

## Current Status

The boilerplate provides a solid foundation with:

- ✅ Next.js 15 with App Router
- ✅ React 19
- ✅ Authentication with Better Auth
- ✅ Database with Drizzle ORM
- ✅ Stripe integration for payments
- ✅ Multi-organization support
- ✅ Role-based access control (RBAC)
- ✅ Internationalization (i18n)
- ✅ Testing with Vitest
- ✅ UI components with ShadCN

## Planned Features

### High Priority

- [ ] **Homepage**
  - Landing page with features showcase
  - Pricing section
  - Call-to-action sections

- [ ] **Authentication Improvements**
  - Add "Sign in" link on registration page
  - Enhance auth flow UX

### Admin Features

- [ ] **Admin - Affiliates**
  - Affiliate program management
  - Commission tracking
  - Affiliate dashboard

- [ ] **Admin - Analytics**
  - Usage analytics dashboard
  - User behavior tracking
  - Revenue metrics

### Authorization & Security

- [ ] **Role Assignment**
  - Implement role assignment UI
  - Reference: http://localhost:3000/en/docs/authorization/roles

- [ ] **Better withAuth Implementation**
  - Improve route protection mechanism
  - Reference: http://localhost:3000/en/docs/authorization/route-protection

### Developer Experience

- [ ] **MCP (Model Context Protocol)**
  - Integration with AI assistants
  - Contextual code understanding

- [ ] **Upstash Integration**
  - Redis caching layer
  - Rate limiting
  - Session management

## Future Considerations

- [ ] Advanced analytics and reporting
- [ ] Webhook management system
- [ ] Advanced email templates
- [ ] Mobile app support
- [ ] API documentation portal
- [ ] Advanced audit logging
- [ ] Multi-tenancy enhancements

## Contributing

If you'd like to contribute to any of these features, please check the [CONTRIBUTING.md](CONTRIBUTING.md) guide and the [AGENTS.md](AGENTS.md) for development guidelines.

## Notes

- All new features must follow the patterns defined in `.cursor/rules/`
- Check existing codebase for similar implementations before starting
- Refer to [CLAUDE.md](CLAUDE.md) for coding guidelines
