import { Group, Text } from "@mantine/core";
import iconUrl from "../assets/icon.svg";


interface Props {
    size?: "sm" | "md" | "lg";
    label?: string;
    justify?: "center" | "flex-start" | "flex-end" | "space-between";
}


export default function Brand({ size = "md", label = "KEUES", justify = "center" }: Props) {

    const fontSize = size === "sm" ? "0.85rem" : size === "lg" ? "1.75rem" : "1.5rem";
    const iconSize = size === "sm" ? 16 : size === "lg" ? 34 : 28;
    const letterSpacing = size === "sm" ? 1 : 2;

    return (
        <Group gap={size === "sm" ? 6 : 10} justify={justify} align="center" wrap="nowrap">
            <img
                src={iconUrl}
                alt="Keues"
                style={{ width: iconSize, height: iconSize }}
            />
            <Text fw={900} style={{ color: "#1a1a2e", fontSize, letterSpacing, lineHeight: 1 }}>
                {label}
            </Text>
        </Group>
    );
}