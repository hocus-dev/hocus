import Head from "next/head";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { Room, PrismaClient } from "@prisma/client";

import styles from "@/styles/Home.module.css";

type Props = {
  rooms: Room[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const db = new PrismaClient();
  const player = await db.player.create({ data: { username: "Hugo" } });
  await db.room.create({ data: { playerId: player.id, name: "Hugo's Room" } });
  const rooms = await db.room.findMany();
  return { props: { rooms } };
};

export default function Home(props: Props) {
  return (
    <div>
      <h1>rooms</h1>
      {props.rooms.map((room) => (
        <p key={room.id.toString()}>{room.name}</p>
      ))}
    </div>
  );
}
