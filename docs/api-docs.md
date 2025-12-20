### API documentation (OpenAPI)

The backend publishes an OpenAPI schema and interactive docs via **drf-spectacular**.

### Endpoints

- **OpenAPI JSON**: `/api/schema/`
- **Swagger UI**: `/api/docs/`
- **Redoc**: `/api/redoc/`

### Keeping docs up to date

`drf-spectacular` generates schema from your DRF views/serializers.

When you add/change endpoints:

- Ensure serializers have clear field types/choices
- Add/adjust view docstrings where helpful
- Run the app and check `/api/docs/` to verify the schema reflects your changes


