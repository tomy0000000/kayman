#!/usr/bin/env python
#
# Generate a customized OpenAPI JSON for frontend client generation.
#
# Usage:
# POSTGRES_PASSWORD=dummy python -m kayman.openapi <path_to_openapi.json>
#
# Reference:
# https://fastapi.tiangolo.com/advanced/generate-clients/#preprocess-the-openapi-specification-for-the-client-generator

import json
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi


def override_openapi(app: FastAPI) -> None:
    def custom_openapi_operation_id() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema

        # Check source of `FastAPI.openapi` to update params
        # that may change in future versions
        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            openapi_version=app.openapi_version,
            summary=app.summary,
            description=app.description,
            terms_of_service=app.terms_of_service,
            contact=app.contact,
            license_info=app.license_info,
            routes=app.routes,
            webhooks=app.webhooks.routes,
            tags=app.openapi_tags,
            servers=app.servers,
            separate_input_output_schemas=app.separate_input_output_schemas,
        )

        for path_data in openapi_schema["paths"].values():
            for operation in path_data.values():
                tag = operation["tags"][0]
                operation_id = operation["operationId"]
                to_remove = f"{tag}-"
                new_operation_id = operation_id[len(to_remove) :]
                operation["operationId"] = new_operation_id

        app.openapi_schema = openapi_schema
        return app.openapi_schema

    app.openapi = custom_openapi_operation_id  # type: ignore[method-assign]


def main() -> None:
    from kayman.main import app

    # Read input file
    if len(sys.argv) < 2:
        print("Usage: convert_openapi.py <path_to_openapi.json>")
        sys.exit(1)

    file_path = Path(sys.argv[1])
    file_path.write_text(json.dumps(app.openapi()))


if __name__ == "__main__":
    main()
