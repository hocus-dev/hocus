import { GetServerSideProps } from "next";
import { Player } from "@prisma/client";
import z from "zod";

type Props = { players: Player[] };

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  return { props: { players: [] } };
};

export default function Player(props: Props) {
  return (
    <div>
      <h1>Players:</h1>
      {props.players.map((p) => (
        <p key={p.id.toString()}>{p.username}</p>
      ))}
    </div>
  );
}
