// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {uniq} from 'lodash';

import {Role} from 'mattermost-redux/types/roles';

import {UserProfile} from 'mattermost-redux/types/users';
import {Dictionary} from 'mattermost-redux/types/utilities';
import {ActionResult} from 'mattermost-redux/types/actions';

import Permissions from 'mattermost-redux/constants/permissions';

import FormError from 'components/form_error';
import BlockableLink from 'components/admin_console/blockable_link';
import SaveChangesPanel from 'components/admin_console/team_channel_settings/save_changes_panel';

import {isError} from 'types/actions';

import SystemRoleUsers from './system_role_users';
import SystemRolePermissions from './system_role_permissions';

type Props = {
    role: Role;
    isDisabled?: boolean;

    actions: {
        editRole(role: Role): Promise<ActionResult>;
        updateUserRoles(userId: string, roles: string): Promise<ActionResult>;
    }
}

type State = {
    usersToAdd: Dictionary<UserProfile>;
    usersToRemove: Dictionary<UserProfile>;
    permissionsToUpdate: Record<string, 'read' | 'write' | false>;
    saving: boolean;
    saveNeeded: boolean;
    serverError: JSX.Element | null;
    saveKey: number;
}

export default class SystemRole extends React.PureComponent<Props, State> {
    public constructor(props: Props) {
        super(props);

        this.state = {
            usersToAdd: {},
            usersToRemove: {},
            saving: false,
            saveNeeded: false,
            serverError: null,
            permissionsToUpdate: {},
            saveKey: 0,
        };
    }

    private getSaveNeeded = (nextState: Partial<State>): boolean => {
        const {usersToAdd, usersToRemove} = {...this.state, ...nextState};
        let saveNeeded = false;
        saveNeeded = Object.keys(usersToAdd).length > 0 || Object.keys(usersToRemove).length > 0;
        return saveNeeded;
    }

    private addUsersToRole = (users: UserProfile[]) => {
        const usersToAdd = {
            ...this.state.usersToAdd,
        };
        const usersToRemove = {
            ...this.state.usersToRemove,
        };
        users.forEach((user) => {
            if (usersToRemove[user.id]) {
                delete usersToRemove[user.id];
            } else {
                usersToAdd[user.id] = user;
            }
        });

        this.setState({usersToAdd, usersToRemove, saveNeeded: this.getSaveNeeded({usersToAdd, usersToRemove})});
    }

    private removeUserFromRole = (user: UserProfile) => {
        const usersToAdd = {
            ...this.state.usersToAdd,
        };
        const usersToRemove = {
            ...this.state.usersToRemove,
        };
        if (usersToAdd[user.id]) {
            delete usersToAdd[user.id];
        } else {
            usersToRemove[user.id] = user;
        }
        this.setState({usersToRemove, usersToAdd, saveNeeded: this.getSaveNeeded({usersToAdd, usersToRemove})});
    }

    private handleSubmit = async () => {
        this.setState({saving: true, saveNeeded: false});
        const {usersToRemove, usersToAdd} = this.state;
        const {role} = this.props;




        const {updateUserRoles} = this.props.actions;
        const userIdsToRemove = Object.keys(usersToRemove);
        let serverError = null;
        if (userIdsToRemove.length > 0) {
            const removeUserPromises: Promise<ActionResult>[] = [];
            userIdsToRemove.forEach((userId) => {
                const user = usersToRemove[userId];
                const updatedRoles = uniq(user.roles.split(' ').filter((r) => r !== role.name)).join(' ');
                removeUserPromises.push(updateUserRoles(userId, updatedRoles));
            });

            const result = await Promise.all(removeUserPromises);
            const resultWithError = result.find(isError);

            // const count = result.filter(isSuccess).length; // To be used for potential telemetry
            if (resultWithError && 'error' in resultWithError) {
                serverError = <FormError error={resultWithError.error.message}/>;
            }
        }

        const userIdsToAdd = Object.keys(usersToAdd);
        if (userIdsToAdd.length > 0 && serverError == null) {
            const addUserPromises: Promise<ActionResult>[] = [];
            userIdsToAdd.forEach((userId) => {
                const user = usersToAdd[userId];
                const updatedRoles = uniq([...user.roles.split(' '), role.name]).join(' ');
                addUserPromises.push(updateUserRoles(userId, updatedRoles));
            });

            const result = await Promise.all(addUserPromises);
            const resultWithError = result.find(isError);

            // const count = result.filter(isSuccess).length; // To be used for potential telemetry
            if (resultWithError && 'error' in resultWithError) {
                serverError = <FormError error={resultWithError.error.message}/>;
            }
        }

        let {saveKey}= this.state;
        if (serverError === null) {
            saveKey += 1;
        }

        this.setState({
            saveNeeded: (serverError !== null),
            saving: false,
            serverError,
            usersToAdd: {},
            usersToRemove: {},
            saveKey,
        });
    }

    private updatePermission = (name: string, value: 'read' | 'write' | false) => {
        this.setState({
            permissionsToUpdate: {
                ...this.state.permissionsToUpdate,
                [name]: value,
            },
        });
    }

    public render() {
        const {usersToAdd, usersToRemove, saving, saveNeeded, serverError, permissionsToUpdate, saveKey} = this.state;
        const {role, isDisabled} = this.props;
        const defaultName = role.name.split('').map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(' ');
        return (
            <div className='wrapper--fixed'>
                <div className='admin-console__header with-back'>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/system_roles'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id={`admin.permissions.roles.${role.name}.name`}
                            defaultMessage={defaultName}
                        />
                    </div>
                </div>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <SystemRolePermissions
                            role={role}
                            permissionsToUpdate={permissionsToUpdate}
                            updatePermission={this.updatePermission}
                        />

                        <SystemRoleUsers
                            key={saveKey}
                            roleName={role.name}
                            usersToAdd={usersToAdd}
                            usersToRemove={usersToRemove}
                            onAddCallback={this.addUsersToRole}
                            onRemoveCallback={this.removeUserFromRole}
                            readOnly={isDisabled}
                        />
                    </div>
                </div>

                <SaveChangesPanel
                    saving={saving}
                    cancelLink='/admin_console/user_management/system_roles'
                    saveNeeded={saveNeeded}
                    onClick={this.handleSubmit}
                    serverError={serverError}
                    isDisabled={isDisabled}
                />
            </div>
        );
    }
}
