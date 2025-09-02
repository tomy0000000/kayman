from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

from kayman.auth import authenticate_client, create_access_token, get_client
from kayman.schemas import clients

tag = {
    "name": "Authorization",
    "description": "Authenticate and verify permissions",
}

auth_router = APIRouter(
    tags=[tag["name"]],
    responses={404: {"description": "Not found"}},
)


@auth_router.post("/token", name="Login")
async def login(
    request: Request, form_data: OAuth2PasswordRequestForm = Depends()
) -> clients.Token:
    client = authenticate_client(
        form_data.username, form_data.password, request.app.state.clients
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect client name or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": client.name})
    return clients.Token(access_token=access_token, token_type="bearer")


@auth_router.get("/client", name="Check Credential")
async def check_credential(
    client: clients.Client = Depends(get_client),
) -> clients.Client:
    return client
