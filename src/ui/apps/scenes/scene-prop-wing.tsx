/** A registered Prop's docked wing body, sharing the gear's PopoutSlot and truthful loading/off states. */
import { useMemo, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { SceneProp } from "./props/prop-contract";
import { Ic } from "../../_shared/ic";
import { PopoutSlot } from "./popout/popout-host";
import { sceneProps } from "./props/registry";
import { propWings } from "./scene-wing-data";

/** Stable registered metadata; enabled state still belongs to the scene's Props reader. */
export function useRegisteredProps() {
  return useMemo(() => {
    const list = sceneProps();
    return { list, wings: propWings(list, list.map((p) => p.id)) };
  }, []);
}

export interface PropWingHost {
  list: readonly SceneProp[];
  on: readonly string[] | null;
  failed?: boolean;
  host: { ctx: AppContext; chat: Chat; onChat?(chat: Chat): void };
}

export function PropWingBody({ prop, state }: { prop: SceneProp; state: PropWingHost }): JSX.Element {
  const why = state.on !== null ? [`${prop.name} is off.`, "Turn it on in Props to open its panel here."]
    : state.failed ? ["This scene's Props could not be read.", "Open the Props wing to try again."] : ["Reading this scene's Props...", prop.name];
  return <>
    <nav className="fold"><div className="crumb">Tools <i>/</i> <b>{prop.name}</b></div></nav>
    {prop.panel && state.on?.includes(prop.id)
      ? <div className="wbody pw" data-open={prop.id} data-part={`scene.props.wing.${prop.id}`}><PopoutSlot kind={prop.panel} {...state.host} /></div>
      : <div className="wbody" data-part={`scene.props.wing.${prop.id}`}><div className="quiet"><div><Ic name={prop.icon} size={34} /><div>{why[0]}</div><small>{why[1]}</small></div></div></div>}
  </>;
}
