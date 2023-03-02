import { useContext } from "react";
import Register from "./Register.jsx";
import { UserContext } from "./UserContext.jsx";
import Chat from "./Chat";

export default function Routes() {
    const {username, id} = useContext(UserContext);

    if (username) {
        return <Chat />;
    }

    return (
        <Register />
    );
}