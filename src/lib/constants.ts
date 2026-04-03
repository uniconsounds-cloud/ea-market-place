export const ROOT_ADMINS = [
    {
        name: 'ครูชัย',
        email: 'bctutor123@gmail.com',
        id: '' // Will be matched by email if ID not known
    },
    {
        name: 'พี่โจ้',
        email: 'juntarasate@gmail.com',
        id: ''
    }
];

export const isRootAdmin = (email: string) => {
    return ROOT_ADMINS.some(admin => admin.email.toLowerCase() === email.toLowerCase());
};

export const getRootAdminName = (email: string) => {
    return ROOT_ADMINS.find(admin => admin.email.toLowerCase() === email.toLowerCase())?.name || 'Admin';
};
