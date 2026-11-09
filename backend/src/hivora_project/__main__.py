"""Recovery from the machine itself: python -m hivora_project reset-account <username>."""

import argparse
import asyncio

from hivora_project.core.config import Settings
from hivora_project.core.db.engine import make_engine, make_sessionmaker
from hivora_project.member.initial import reset_account


async def _reset(username: str) -> str:
    engine = make_engine(Settings().db_url)
    try:
        return await reset_account(make_sessionmaker(engine), username)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(prog="hivora_project")
    commands = parser.add_subparsers(dest="command", required=True)
    reset = commands.add_parser("reset-account", help="new one-time password, TOTP off")
    reset.add_argument("username")
    args = parser.parse_args()
    print(f"One-time password: {asyncio.run(_reset(args.username))}")


if __name__ == "__main__":
    main()
